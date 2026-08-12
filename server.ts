import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "genius-lyrics";
import { parse } from "node-html-parser";
import fs from "fs/promises";
import ytSearch from "yt-search";
import ytdl from "@distube/ytdl-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERS_FILE = path.join(__dirname, 'users.json');

// Ensure users.json exists
async function initDb() {
  try {
    await fs.access(USERS_FILE);
  } catch {
    await fs.writeFile(USERS_FILE, JSON.stringify([]));
  }
}
initDb();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Auth routes
  app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    
    try {
      const data = await fs.readFile(USERS_FILE, 'utf-8');
      const users = JSON.parse(data);
      
      if (users.find((u: any) => u.username === username)) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      
      users.push({ username, password });
      await fs.writeFile(USERS_FILE, JSON.stringify(users));
      res.json({ success: true, username });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    try {
      const data = await fs.readFile(USERS_FILE, 'utf-8');
      const users = JSON.parse(data);
      
      const user = users.find((u: any) => u.username === username && u.password === password);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      res.json({ success: true, username, playlists: user.playlists || [] });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.post('/api/playlists', async (req, res) => {
    const { username, playlists } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });

    try {
      const data = await fs.readFile(USERS_FILE, 'utf-8');
      const users = JSON.parse(data);
      
      const userIndex = users.findIndex((u: any) => u.username === username);
      if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      users[userIndex].playlists = playlists;
      await fs.writeFile(USERS_FILE, JSON.stringify(users));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.post('/api/user', async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });

    try {
      const data = await fs.readFile(USERS_FILE, 'utf-8');
      const users = JSON.parse(data);
      
      const user = users.find((u: any) => u.username === username);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({ success: true, username: user.username, playlists: user.playlists || [] });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.post('/api/user/image', async (req, res) => {
    const { username, profileImage } = req.body;
    if (!username || !profileImage) return res.status(400).json({ error: 'Username and profileImage required' });

    try {
      const data = await fs.readFile(USERS_FILE, 'utf-8');
      const users = JSON.parse(data);
      
      const userIndex = users.findIndex((u: any) => u.username === username);
      if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      users[userIndex].profileImage = profileImage;
      await fs.writeFile(USERS_FILE, JSON.stringify(users));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/search", async (req, res) => {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    try {
      const response = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      res.json({
        tracks: data.data.map((track: any) => ({
          id: track.id,
          title: track.title,
          artist: track.artist.name,
          cover: track.album.cover_medium,
          preview: track.preview
        }))
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch from Deezer API" });
    }
  });

  app.get("/api/recommended", async (req, res) => {
    try {
      const response = await fetch(`https://api.deezer.com/chart/0/tracks`);
      const data = await response.json();
      res.json({
        tracks: data.data.map((track: any) => ({
          id: track.id,
          title: track.title,
          artist: track.artist.name,
          cover: track.album.cover_medium,
          preview: track.preview
        }))
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recommended tracks" });
    }
  });

  app.get("/api/play", async (req, res) => {
    const artist = req.query.artist as string;
    const title = req.query.title as string;
    if (!artist || !title) {
      return res.status(400).json({ error: "Artist and title are required" });
    }

    try {
      const searchResult = await ytSearch(`${title} ${artist} audio`);
      const video = searchResult.videos.length > 0 ? searchResult.videos[0] : null;

      if (video) {
        res.json({ url: video.url, videoId: video.videoId });
      } else {
        res.status(404).json({ error: "No video found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to search YouTube" });
    }
  });

  app.get("/api/stream", async (req, res) => {
    const videoId = req.query.videoId as string;
    if (!videoId) return res.status(400).send("Video ID required");

    try {
      const info = await ytdl.getInfo(videoId);
      const format = ytdl.chooseFormat(info.formats, { quality: "highestaudio", filter: "audioonly" });
      
      if (!format) {
        return res.status(404).send("No audio format found");
      }

      res.setHeader('Content-Type', 'audio/mpeg');
      ytdl(videoId, { format }).pipe(res);
    } catch (error) {
      console.error("YTDL Error:", error);
      res.status(500).send("Failed to stream audio");
    }
  });

  app.get("/api/lyrics", async (req, res) => {
    const artist = req.query.artist as string;
    const title = req.query.title as string;
    if (!artist || !title) {
      return res.status(400).json({ error: "Artist and title are required" });
    }

    // Clean title: remove parenthetical content like "(Slow Version)"
    const cleanTitle = title.replace(/\s*\(.*?\)/g, '').trim();
    const searchQuery = `${cleanTitle} ${artist}`;

    // Helper function to try lyrics.ovh
    const tryOvh = async () => {
      try {
        const response = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(cleanTitle)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.lyrics) return data.lyrics;
        }
      } catch (err) {
        console.error("OVH fallback error:", err);
      }
      return null;
    };

    try {
      // Initialize Genius client with the provided access token
      const geniusClient = new Client(process.env.GENIUS_ACCESS_TOKEN || "I0fHA-hiK_0aRVDXxggqvo5eQd0NuENz94pN_AFckTE3F4xS_61dIJmjDkmbxTUD");
      
      const searches = await geniusClient.songs.search(searchQuery);
      if (searches.length === 0) {
        const ovhLyrics = await tryOvh();
        if (ovhLyrics) return res.json({ lyrics: ovhLyrics });
        return res.status(404).json({ error: "Lyrics not found" });
      }

      const firstSong = searches[0];
      
      // Fetch the HTML via a proxy to bypass Cloudflare
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(firstSong.url)}`;
      const proxyResponse = await fetch(proxyUrl);
      
      if (!proxyResponse.ok) {
        const ovhLyrics = await tryOvh();
        if (ovhLyrics) return res.json({ lyrics: ovhLyrics });
        return res.status(404).json({ error: "Lyrics not found" });
      }
      
      const contentType = proxyResponse.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const ovhLyrics = await tryOvh();
        if (ovhLyrics) return res.json({ lyrics: ovhLyrics });
        return res.status(404).json({ error: "Lyrics not found" });
      }

      const proxyData = await proxyResponse.json();
      const html = proxyData.contents;
      
      if (!html || html.includes("Just a moment...")) {
        const ovhLyrics = await tryOvh();
        if (ovhLyrics) return res.json({ lyrics: ovhLyrics });
        return res.status(404).json({ error: "Lyrics not found (Blocked by Cloudflare)" });
      }

      // Parse the HTML to extract lyrics
      const document = parse(html);
      const lyricsRoot = document.getElementById("lyrics-root");
      
      if (!lyricsRoot) {
        const ovhLyrics = await tryOvh();
        if (ovhLyrics) return res.json({ lyrics: ovhLyrics });
        return res.status(404).json({ error: "Lyrics not found" });
      }

      const lyrics = lyricsRoot
        .querySelectorAll("[data-lyrics-container='true']")
        .map((x) => {
          x.querySelectorAll("br").forEach((y) => {
            y.replaceWith(parse("\n"));
          });
          return x.text;
        })
        .join("\n")
        .trim();

      if (lyrics && lyrics.length > 0) {
        return res.json({ lyrics });
      } else {
        const ovhLyrics = await tryOvh();
        if (ovhLyrics) return res.json({ lyrics: ovhLyrics });
        return res.status(404).json({ error: "Lyrics not found" });
      }
    } catch (err) {
      console.error(`Genius API error for ${searchQuery}:`, err);
      const ovhLyrics = await tryOvh();
      if (ovhLyrics) return res.json({ lyrics: ovhLyrics });
      return res.status(404).json({ error: "Lyrics not found" });
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
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
