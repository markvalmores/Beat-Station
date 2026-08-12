// src/components/Lyrics.tsx
import { useState, useEffect } from 'react';
import { fetchLyrics } from '../services/lyricsService';

interface LyricsProps {
  artist: string;
  title: string;
}

export default function Lyrics({ artist, title }: LyricsProps) {
  const [lyrics, setLyrics] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function getLyrics() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchLyrics(artist, title);
        setLyrics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch lyrics');
      } finally {
        setLoading(false);
      }
    }
    getLyrics();
  }, [artist, title]);

  if (loading) return <div className="text-gray-400">Loading lyrics...</div>;
  if (error) return <div className="text-red-400">{error}</div>;

  return (
    <div className="whitespace-pre-wrap text-lg leading-relaxed text-gray-200 font-mono">
      {lyrics}
    </div>
  );
}
