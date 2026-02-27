import express from "express";
import { createServer as createViteServer } from "vite";
import ytdl from "@distube/ytdl-core";
import axios from "axios";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.post("/api/fetch-info", async (req, res) => {
    const { url } = req.body;
    console.log(`[API] Fetching info for: ${url}`);

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      if (ytdl.validateURL(url)) {
        // YouTube
        try {
          const info = await ytdl.getInfo(url, {
            requestOptions: {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              }
            }
          });
          
          const combinedFormats = info.formats.filter(f => f.hasVideo && f.hasAudio);
          const videoOnlyFormats = info.formats.filter(f => f.hasVideo && !f.hasAudio && f.container === "mp4");
          const audioFormats = ytdl.filterFormats(info.formats, "audioonly");
          
          const allFormats = [
            ...combinedFormats.map(f => ({
              quality: f.qualityLabel || "Video",
              url: f.url,
              container: f.container || "mp4",
              hasVideo: true,
              hasAudio: true,
              note: ""
            })),
            ...videoOnlyFormats.slice(0, 3).map(f => ({
              quality: `${f.qualityLabel} (No Sound)`,
              url: f.url,
              container: f.container || "mp4",
              hasVideo: true,
              hasAudio: false,
              note: "Video Only"
            })),
            ...audioFormats.slice(0, 2).map(f => ({
              quality: `${f.audioBitrate}kbps Audio`,
              url: f.url,
              container: "mp3",
              hasVideo: false,
              hasAudio: true,
              note: "Audio Only"
            }))
          ];
          
          allFormats.sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0));
          
          return res.json({
            platform: "youtube",
            title: info.videoDetails.title,
            thumbnail: info.videoDetails.thumbnails[0].url,
            duration: info.videoDetails.lengthSeconds,
            author: info.videoDetails.author.name,
            formats: allFormats,
            message: "YouTube serves 1080p+ as separate streams. Combined video+audio is usually max 720p."
          });
        } catch (ytError: any) {
          console.error("[YouTube Error]", ytError.message);
          if (ytError.message.includes("confirm you're not a bot")) {
            return res.status(403).json({ 
              error: "YouTube Bot Detection", 
              message: "YouTube has flagged this request. Try a different video or try again later." 
            });
          }
          return res.status(500).json({ error: "YouTube extraction failed: " + ytError.message });
        }
      } else if (url.includes("tiktok.com")) {
        // TikTok using TikWM API
        try {
          const response = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, { timeout: 10000 });
          const data = response.data;

          if (data && data.code === 0) {
            return res.json({
              platform: "tiktok",
              title: data.data.title || "TikTok Video",
              thumbnail: data.data.cover,
              author: data.data.author.nickname,
              formats: [
                { quality: "No Watermark", url: data.data.play, container: "mp4", hasVideo: true, hasAudio: true },
                { quality: "With Watermark", url: data.data.wmplay, container: "mp4", hasVideo: true, hasAudio: true },
                { quality: "Audio Only", url: data.data.music, container: "mp3", hasVideo: false, hasAudio: true }
              ]
            });
          } else {
            return res.status(400).json({ error: data?.msg || "TikTok video not found or private." });
          }
        } catch (tkError: any) {
          console.error("[TikTok Error]", tkError.message);
          return res.status(500).json({ error: "TikTok API error: " + tkError.message });
        }
      } else if (url.includes("instagram.com") || url.includes("facebook.com") || url.includes("fb.watch") || url.includes("fb.com")) {
        // Facebook & Instagram
        const apis = [
          `https://api.vkrdown.com/server/?url=${encodeURIComponent(url)}`,
          `https://api.vkrdown.com/api/main.php?url=${encodeURIComponent(url)}`
        ];

        for (const apiUrl of apis) {
          try {
            const response = await axios.get(apiUrl, { timeout: 10000 });
            const data = response.data;

            if (data && (data.status === "success" || data.data || data.url)) {
              const videoData = data.data || data;
              const medias = videoData.medias || (videoData.url ? [{ url: videoData.url, quality: "HD", extension: "mp4" }] : []);
              
              if (medias.length > 0) {
                return res.json({
                  platform: url.includes("instagram") ? "instagram" : "facebook",
                  title: videoData.title || "Social Media Video",
                  thumbnail: videoData.thumbnail || videoData.cover || "",
                  formats: medias.map((m: any) => ({
                    quality: m.quality || m.resolution || "Download",
                    url: m.url,
                    container: m.extension || "mp4",
                    hasVideo: true,
                    hasAudio: true
                  }))
                });
              }
            }
          } catch (err) {
            continue;
          }
        }

        return res.status(400).json({ 
          error: "Extraction Failed", 
          message: "Could not extract video. The post might be private or the API is down." 
        });
      } else {
        return res.status(400).json({ error: "Unsupported platform or invalid URL" });
      }
    } catch (error: any) {
      console.error("[Global API Error]", error);
      return res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Proxy for downloading to avoid CORS issues and CDN blocks
  app.get("/api/download", async (req, res) => {
    const { url, filename } = req.query;
    if (!url) return res.status(400).send("URL required");

    try {
      const response = await axios({
        method: "get",
        url: url as string,
        responseType: "stream",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://www.tiktok.com/",
          "Accept": "*/*"
        },
        timeout: 20000 // 20 seconds timeout
      });

      const cleanFilename = (filename as string || "video").replace(/[^a-z0-9]/gi, '_').toLowerCase();
      res.setHeader("Content-Disposition", `attachment; filename="${cleanFilename}.mp4"`);
      res.setHeader("Content-Type", "video/mp4");
      
      response.data.pipe(res);
    } catch (error: any) {
      console.error("Download proxy error:", error.message);
      res.status(500).send(`Download failed: ${error.message}`);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
