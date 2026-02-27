import React, { useState } from 'react';
import { Download, Link as LinkIcon, AlertCircle, Loader2, Youtube, Instagram, Facebook, Music2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VideoFormat {
  quality: string;
  url: string;
  container: string;
  hasVideo: boolean;
  hasAudio: boolean;
}

interface VideoInfo {
  platform: string;
  title: string;
  thumbnail: string;
  duration?: string;
  author?: string;
  formats?: VideoFormat[];
  error?: string;
  message?: string;
}

export default function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError(null);
    setVideoInfo(null);

    try {
      const response = await fetch('/api/fetch-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Server response was not JSON:", text);
        throw new Error("Server returned an invalid response. The service might be temporarily busy or restarting. Please try again in a few seconds.");
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch video info');
      }

      if (data.error) {
        setError(data.error);
      } else {
        setVideoInfo(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'youtube': return <Youtube className="w-5 h-5 text-red-500" />;
      case 'instagram': return <Instagram className="w-5 h-5 text-pink-500" />;
      case 'facebook': return <Facebook className="w-5 h-5 text-blue-600" />;
      case 'tiktok': return <Music2 className="w-5 h-5 text-white" />;
      default: return <LinkIcon className="w-5 h-5 text-gray-400" />;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Link copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-[#E6E6E6] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-[#151619] rounded-2xl shadow-2xl overflow-hidden border border-white/5">
        <div className="p-6 border-b border-white/10 bg-gradient-to-b from-white/5 to-transparent">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-white font-mono text-xs tracking-[0.2em] uppercase opacity-70">
              SnapFetch v1.0
            </h1>
            <div className="flex gap-1.5">
              <div className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              <div className="w-2 h-2 rounded-full bg-white/10" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Video Downloader</h2>
          <p className="text-white/40 text-xs mt-1 font-mono uppercase tracking-wider">Universal Media Extractor</p>
        </div>

        {/* Main Control Panel */}
        <div className="p-6 space-y-6">
          <form onSubmit={handleFetch} className="space-y-4">
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <LinkIcon className="w-4 h-4 text-white/30 group-focus-within:text-white/60 transition-colors" />
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste video URL here..."
                className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-11 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 focus:bg-black/60 transition-all text-sm"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading || !url}
              className="w-full bg-white text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>PROCESSING...</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  <span>FETCH VIDEO</span>
                </>
              )}
            </button>
          </form>

          {/* Error Display */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-3 items-start"
              >
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-red-500 text-sm font-bold uppercase tracking-wider text-[10px]">Error Detected</p>
                  <p className="text-white/80 text-sm leading-relaxed">{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Video Info Display */}
          <AnimatePresence>
            {videoInfo && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden">
                  <div className="aspect-video relative">
                    <img
                      src={videoInfo.thumbnail}
                      alt={videoInfo.title}
                      className="w-full h-full object-cover opacity-60"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md rounded-lg px-2 py-1 flex items-center gap-2 border border-white/10">
                      {getPlatformIcon(videoInfo.platform)}
                      <span className="text-white text-[10px] font-bold uppercase tracking-widest">{videoInfo.platform}</span>
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <h3 className="text-white font-medium text-sm line-clamp-2 leading-snug">{videoInfo.title}</h3>
                    {videoInfo.author && (
                      <p className="text-white/40 text-xs font-mono">@{videoInfo.author}</p>
                    )}
                  </div>
                </div>

                {/* Download Options */}
                <div className="space-y-2">
                  <p className="text-white/30 text-[10px] font-bold uppercase tracking-[0.2em] px-1">Available Formats</p>
                  <div className="grid gap-2">
                    {videoInfo.formats && videoInfo.formats.length > 0 ? (
                      videoInfo.formats.slice(0, 5).map((format, idx) => (
                        <div key={idx} className="flex gap-2">
                          <a
                            href={`/api/download?url=${encodeURIComponent(format.url)}&filename=${encodeURIComponent(videoInfo.title)}`}
                            download={`${videoInfo.title}.mp4`}
                            className="flex-1 flex items-center justify-between bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 p-3 rounded-xl transition-all group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-white group-hover:text-black transition-colors">
                                <Download className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-white text-sm font-medium">{format.quality || 'Auto'}</p>
                                <p className="text-white/40 text-[10px] uppercase font-mono">
                                  {format.container} • {format.hasVideo ? (format.hasAudio ? 'Video + Audio' : 'Video Only') : 'Audio Only'}
                                </p>
                              </div>
                            </div>
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </a>
                          <button 
                            onClick={() => copyToClipboard(format.url)}
                            className="bg-white/5 border border-white/10 hover:bg-white/10 p-3 rounded-xl text-white/40 hover:text-white transition-all"
                            title="Copy Direct Link"
                          >
                            <LinkIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                        <p className="text-amber-500 text-xs leading-relaxed">
                          {videoInfo.message || "No direct download formats could be extracted automatically."}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Status Bar */}
        <div className="p-4 bg-black/40 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className={`w-1 h-3 rounded-full ${i <= 3 ? 'bg-emerald-500/50' : 'bg-white/10'}`} />
              ))}
            </div>
            <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">System Ready</span>
          </div>
          <span className="text-[10px] font-mono text-white/20">SECURE_LINK_ENCRYPTED</span>
        </div>
      </div>

      {/* Background Decorative Elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-emerald-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-blue-500/5 blur-[120px] rounded-full" />
      </div>
    </div>
  );
}
