export async function searchSongs(query: string) {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) {
    throw new Error('Failed to search songs');
  }
  return response.json();
}

export async function getRecommendedSongs() {
  const response = await fetch('/api/recommended');
  if (!response.ok) {
    throw new Error('Failed to fetch recommended songs');
  }
  return response.json();
}
