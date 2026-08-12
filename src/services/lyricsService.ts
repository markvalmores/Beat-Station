/// <reference types="vite/client" />
// src/services/lyricsService.ts

export async function fetchLyrics(artist: string, title: string): Promise<string> {
  const response = await fetch(`/api/lyrics?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`);
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch lyrics');
  }
  
  const data = await response.json();
  return data.lyrics;
}
