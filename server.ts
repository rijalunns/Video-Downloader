import express from "express";
import { createServer as createViteServer } from "vite";
import ytdl from "@distube/ytdl-core";
import axios from "axios";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

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
        // Facebook & Instagram using public API proxies
        
        // Clean URL to remove tracking parameters but keep essential parts
        let cleanUrl = url;
        try {
          const urlObj = new URL(url);
          urlObj.search = ""; 
          cleanUrl = urlObj.toString();
        } catch (e) {
          cleanUrl = url;
        }

        const apis = [
          // Cobalt API (Primary)
          async (u: string) => {
            const res = await axios.post("https://api.cobalt.tools/api/json", {
              url: u,
              vQuality: "720",
              vCodec: "h264",
              isAudioOnly: false,
              isNoTTWatermark: true
            }, {
              headers: { 
                "Accept": "application/json", 
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Origin": "https://cobalt.tools",
                "Referer": "https://cobalt.tools/",
                "x-requested-with": "XMLHttpRequest"
              },
              timeout: 15000
            });
            
            if (res.data.status === "stream" || res.data.status === "redirect") {
              return {
                platform: u.includes("instagram") ? "instagram" : "facebook",
                title: "Social Media Video",
                thumbnail: "",
                formats: [{ quality: "HD", url: res.data.url, container: "mp4", hasVideo: true, hasAudio: true }]
              };
            }
            if (res.data.status === "picker") {
              return {
                platform: u.includes("instagram") ? "instagram" : "facebook",
                title: "Social Media Gallery",
                thumbnail: res.data.picker[0].thumb || "",
                formats: res.data.picker.map((p: any, i: number) => ({
                  quality: `Item ${i + 1}`,
                  url: p.url,
                  container: "mp4",
                  hasVideo: true,
                  hasAudio: true
                }))
              };
            }
            throw new Error(`Cobalt status: ${res.data.status}`);
          },
          // SnapSave / TikWM Style API (Secondary)
          async (u: string) => {
            const res = await axios.get(`https://api.vkrdown.com/api/main.php?url=${encodeURIComponent(u)}`, { 
              timeout: 12000,
              headers: { 
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
              }
            });
            
            if (res.data && (res.data.status === "success" || res.data.data)) {
              const videoData = res.data.data || res.data;
              const medias = videoData.medias || [];
              if (medias.length > 0) {
                return {
                  platform: u.includes("instagram") ? "instagram" : "facebook",
                  title: videoData.title || "Social Media Video",
                  thumbnail: videoData.thumbnail || "",
                  formats: medias.map((m: any) => ({
                    quality: m.quality || "Download",
                    url: m.url,
                    container: "mp4",
                    hasVideo: true,
                    hasAudio: true
                  }))
                };
              }
            }
            throw new Error("Fallback API failed");
          },
          // Third Fallback
          async (u: string) => {
            const res = await axios.get(`https://api.downloadit.net/api/v1/download?url=${encodeURIComponent(u)}`, {
              timeout: 10000,
              headers: { "User-Agent": "Mozilla/5.0" }
            }).catch(() => ({ data: null }));
            
            if (res.data && res.data.medias) {
              return {
                platform: u.includes("instagram") ? "instagram" : "facebook",
                title: "Social Media Video",
                thumbnail: "",
                formats: res.data.medias.map((m: any) => ({
                  quality: m.quality || "HD",
                  url: m.url,
                  container: "mp4",
                  hasVideo: true,
                  hasAudio: true
                }))
              };
            }
            throw new Error("Third fallback failed");
          }
        ];

        for (const apiFn of apis) {
          try {
            let result;
            try {
              result = await apiFn(cleanUrl);
            } catch (e) {
              result = await apiFn(url);
            }
            if (result) return res.json(result);
          } catch (err: any) {
            console.warn(`[API Fallback] Failed:`, err.response?.status || err.message);
            continue;
          }
        }

        return res.status(400).json({ 
          error: "Extraction Failed", 
          message: "Instagram and Facebook have extremely high security. The cloud server is currently blocked (403). Please ensure the post is PUBLIC and try again later, or try a different link." 
        });
      } else {
        return res.status(400).json({ error: "Unsupported platform or invalid URL" });
      }
    } catch (error: any) {
      console.error("[Global API Error]", error);
      return res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Proxy for downloading
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
        timeout: 20000 
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

  // Catch-all for undefined API routes (PENTING: Agar tidak mengembalikan HTML saat API error)
  app.all("/api/*", (req, res) => {
    res.status(404).json({ 
      error: "API Route Not Found", 
      message: `Rute ${req.method} ${req.path} tidak ditemukan di server.` 
    });
  });

  // Vite / Static Files Handling
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT} (NODE_ENV: ${process.env.NODE_ENV || 'development'})`);
  });
}

startServer();
