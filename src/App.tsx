/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Search, Play, Pause, SkipForward, SkipBack, Repeat, Volume2, X, Plus, ListMusic, Loader2 } from 'lucide-react';
import { searchSongs, getRecommendedSongs } from './services/musicService';

const formatTime = (time: number) => {
  if (!time || isNaN(time)) return "0:00";
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export default function App() {
  const [activeTab, setActiveTab] = useState('Home');
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState([]);
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.5);
  const audioRef = useRef<HTMLAudioElement>(null);
  const currentTrackIdRef = useRef<string | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [playlists, setPlaylists] = useState<{id: string, name: string, tracks: any[]}[]>([]);
  const [activePlaylist, setActivePlaylist] = useState<string | null>(null);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [trackToAdd, setTrackToAdd] = useState<any>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<'login' | 'register' | null>(null);
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isPlaylistsLoaded, setIsPlaylistsLoaded] = useState(false);

  const loadRecommended = async () => {
    const data = await getRecommendedSongs();
    setTracks(data.tracks);
  };

  useEffect(() => {
    loadRecommended();
    // Check if user is logged in from localStorage
    const savedUser = localStorage.getItem('beatstation_user');
    if (savedUser) {
      setCurrentUser(savedUser);
      fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: savedUser })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (data.playlists) setPlaylists(data.playlists);
          if (data.profileImage) setProfileImage(data.profileImage);
        }
        setIsPlaylistsLoaded(true);
      })
      .catch(err => {
        console.error("Failed to load user data:", err);
        setIsPlaylistsLoaded(true);
      });
    } else {
      setIsPlaylistsLoaded(true);
    }

    return () => {
      // Cleanup if needed
    };
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const endpoint = showAuthModal === 'login' ? '/api/login' : '/api/register';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authUsername, password: authPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');
      
      setCurrentUser(data.username);
      if (data.playlists) {
        setPlaylists(data.playlists);
      } else {
        setPlaylists([]);
      }
      if (data.profileImage) {
        setProfileImage(data.profileImage);
      } else {
        setProfileImage(null);
      }
      setIsPlaylistsLoaded(true);
      localStorage.setItem('beatstation_user', data.username);
      setShowAuthModal(null);
      setAuthUsername('');
      setAuthPassword('');
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setProfileImage(null);
    setPlaylists([]);
    setIsPlaylistsLoaded(true);
    localStorage.removeItem('beatstation_user');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    // Check if file is an image
    if (!file.type.match('image/(jpeg|png|gif)')) {
      alert('Please upload a valid image file (JPG, PNG, or GIF).');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Image = reader.result as string;
      setProfileImage(base64Image);

      try {
        await fetch('/api/user/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: currentUser, profileImage: base64Image })
        });
      } catch (err) {
        console.error("Failed to save profile image:", err);
      }
    };
    reader.readAsDataURL(file);
  };

  // Save playlists to server when they change
  useEffect(() => {
    if (currentUser && isPlaylistsLoaded) {
      fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser, playlists })
      }).catch(err => console.error("Failed to save playlists:", err));
    }
  }, [playlists, currentUser, isPlaylistsLoaded]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setActiveTab('Search');
    const data = await searchSongs(query);
    setTracks(data.tracks);
  };

  // Update volume whenever it changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Handle play/pause state syncing
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(e => console.error("Autoplay prevented", e));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, audioUrl]);

  const handleTrackClick = async (track: any) => {
    if (selectedTrack?.id === track.id) {
      togglePlay();
      return;
    }

    currentTrackIdRef.current = track.id;
    setSelectedTrack(track);
    setCurrentTime(0);
    setDuration(0);
    setIsLoadingAudio(true);

    // Play preview immediately to unlock audio context and provide instant feedback
    if (track.preview) {
      setAudioUrl(track.preview);
      setIsPlaying(true);
    } else {
      setAudioUrl(null);
      setIsPlaying(false);
    }

    try {
      const res = await fetch(`/api/play?artist=${encodeURIComponent(track.artist)}&title=${encodeURIComponent(track.title)}`);
      const data = await res.json();
      
      // Only upgrade to YouTube stream if the user hasn't clicked another track
      if (currentTrackIdRef.current === track.id) {
        if (res.ok && data.videoId) {
          // Use our backend stream route instead of youtube iframe
          setAudioUrl(`/api/stream?videoId=${data.videoId}`);
          setIsPlaying(true);
        } else {
          console.error("Failed to find full audio for track");
        }
        setIsLoadingAudio(false);
      }
    } catch (err) {
      console.error("Error fetching audio:", err);
      if (currentTrackIdRef.current === track.id) {
        setIsLoadingAudio(false);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const createPlaylist = () => {
    if (!currentUser) {
      setShowAuthModal('login');
      return;
    }
    if (!newPlaylistName.trim()) return;
    const newPlaylist = { id: Date.now().toString(), name: newPlaylistName, tracks: [] };
    setPlaylists([...playlists, newPlaylist]);
    setNewPlaylistName('');
  };

  const addToPlaylist = (playlistId: string) => {
    if (!currentUser) {
      setShowAuthModal('login');
      return;
    }
    setPlaylists(playlists.map(p => {
      if (p.id === playlistId && trackToAdd) {
        if (!p.tracks.find(t => t.id === trackToAdd.id)) {
          return { ...p, tracks: [...p.tracks, trackToAdd] };
        }
      }
      return p;
    }));
    setShowPlaylistModal(false);
    setTrackToAdd(null);
  };

  const togglePlay = () => {
    if (!audioUrl || isLoadingAudio) return;
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans">
      {/* Sidebar */}
      <nav className="fixed left-0 top-0 h-full w-64 bg-[#101010] p-6 flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-bold text-emerald-400 mb-6">BeatStation</h1>
          
          {/* Profile Section */}
          <div className="bg-[#1a1a1a] p-4 rounded-xl border border-white/5 flex flex-col gap-3">
            {currentUser ? (
              <div className="flex items-center gap-3 w-full">
                <div 
                  className="relative w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 cursor-pointer group overflow-hidden"
                  onClick={() => fileInputRef.current?.click()}
                  title="Change profile picture"
                >
                  {profileImage ? (
                    <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-emerald-400 font-bold">{currentUser[0].toUpperCase()}</span>
                  )}
                  <div className="absolute inset-0 bg-black/50 items-center justify-center opacity-0 group-hover:opacity-100 transition flex">
                    <span className="text-[10px] text-white font-semibold">EDIT</span>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageUpload} 
                    accept="image/jpeg, image/png, image/gif" 
                    className="hidden" 
                  />
                </div>
                <div className="overflow-hidden flex-1">
                  <p className="text-sm font-semibold truncate">{currentUser}</p>
                  <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-white transition">Log out</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 w-full">
                <p className="text-xs text-gray-400 text-center mb-1">Sign in to save playlists</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowAuthModal('login')} className="flex-1 bg-white/10 hover:bg-white/20 text-white text-xs py-2 rounded-lg transition">Log In</button>
                  <button onClick={() => setShowAuthModal('register')} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs py-2 rounded-lg transition">Sign Up</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {['Home', 'Library', 'Search'].map(tab => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab !== 'Library') setActivePlaylist(null);
                if (tab === 'Home') {
                  setQuery('');
                  loadRecommended();
                }
              }}
              className={`text-left p-3 rounded-xl transition ${activeTab === tab ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-white/5'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="ml-64 p-8">
        <header className="flex justify-between items-center mb-12">
          <div className="relative w-96">
            <Search className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search for songs, artists, or albums..."
              className="w-full bg-[#1a1a1a] p-3 pl-12 rounded-2xl border border-white/10 focus:border-emerald-500 outline-none transition"
            />
          </div>
        </header>

        {/* Song Grid */}
        {activeTab === 'Library' ? (
          <section>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold">Your Library</h2>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="New Playlist Name" 
                  className="bg-[#1a1a1a] p-2 rounded-lg border border-white/10 focus:border-emerald-500 outline-none"
                />
                <button onClick={createPlaylist} className="bg-emerald-500 text-black px-4 py-2 rounded-lg font-semibold hover:bg-emerald-400 transition">
                  Create
                </button>
              </div>
            </div>
            
            {activePlaylist ? (
              <div>
                <button onClick={() => setActivePlaylist(null)} className="mb-6 text-emerald-400 hover:underline flex items-center gap-2">
                  &larr; Back to Playlists
                </button>
                <h3 className="text-2xl font-bold mb-6">{playlists.find(p => p.id === activePlaylist)?.name}</h3>
                <div className="grid grid-cols-4 gap-6">
                  {playlists.find(p => p.id === activePlaylist)?.tracks.map((track: any) => (
                    <div key={track.id} onClick={() => handleTrackClick(track)} className="bg-[#1a1a1a] p-4 rounded-2xl border border-white/5 hover:border-emerald-500/50 transition cursor-pointer group relative">
                      <img src={track.cover} alt={track.title} referrerPolicy="no-referrer" className="aspect-square bg-gray-800 rounded-xl mb-4 group-hover:scale-105 transition" />
                      <h3 className="font-semibold truncate">{track.title}</h3>
                      <p className="text-sm text-gray-400 truncate">{track.artist}</p>
                    </div>
                  ))}
                  {playlists.find(p => p.id === activePlaylist)?.tracks.length === 0 && (
                    <p className="text-gray-400 col-span-4">This playlist is empty. Add songs from Home or Search.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-6">
                {playlists.map(playlist => (
                  <div key={playlist.id} onClick={() => setActivePlaylist(playlist.id)} className="bg-[#1a1a1a] p-6 rounded-2xl border border-white/5 hover:border-emerald-500/50 transition cursor-pointer flex flex-col items-center justify-center gap-4">
                    <div className="w-20 h-20 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400">
                      <ListMusic size={40} />
                    </div>
                    <h3 className="font-semibold text-lg truncate w-full text-center">{playlist.name}</h3>
                    <p className="text-sm text-gray-400">{playlist.tracks.length} tracks</p>
                  </div>
                ))}
                {playlists.length === 0 && (
                  <p className="text-gray-400 col-span-4">No playlists yet. Create one above!</p>
                )}
              </div>
            )}
          </section>
        ) : (
          <section>
            <h2 className="text-3xl font-bold mb-8">{query && activeTab === 'Search' ? 'Search Results' : 'Recommended for You'}</h2>
            <div className="grid grid-cols-4 gap-6">
              {tracks.map((track: any) => (
                <div key={track.id} className="bg-[#1a1a1a] p-4 rounded-2xl border border-white/5 hover:border-emerald-500/50 transition group relative">
                  <div className="cursor-pointer" onClick={() => handleTrackClick(track)}>
                    <img src={track.cover} alt={track.title} referrerPolicy="no-referrer" className="aspect-square bg-gray-800 rounded-xl mb-4 group-hover:scale-105 transition" />
                    <h3 className="font-semibold truncate">{track.title}</h3>
                    <p className="text-sm text-gray-400 truncate">{track.artist}</p>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!currentUser) {
                        setShowAuthModal('login');
                      } else {
                        setTrackToAdd(track);
                        setShowPlaylistModal(true);
                      }
                    }}
                    className="absolute top-6 right-6 p-2 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition hover:bg-emerald-500 hover:text-black"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] p-8 rounded-3xl w-96 border border-white/10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">{showAuthModal === 'login' ? 'Log In' : 'Sign Up'}</h3>
              <button onClick={() => { setShowAuthModal(null); setAuthError(''); }} className="text-gray-400 hover:text-white"><X /></button>
            </div>
            <form onSubmit={handleAuth} className="flex flex-col gap-4">
              <input
                type="text"
                placeholder="Username"
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
                className="bg-[#0a0a0a] p-3 rounded-xl border border-white/10 focus:border-emerald-500 outline-none"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="bg-[#0a0a0a] p-3 rounded-xl border border-white/10 focus:border-emerald-500 outline-none"
                required
              />
              {authError && <p className="text-red-400 text-sm">{authError}</p>}
              <button type="submit" className="bg-emerald-500 text-black font-bold p-3 rounded-xl hover:bg-emerald-400 transition mt-2">
                {showAuthModal === 'login' ? 'Log In' : 'Create Account'}
              </button>
            </form>
            <p className="text-center text-sm text-gray-400 mt-6">
              {showAuthModal === 'login' ? "Don't have an account? " : "Already have an account? "}
              <button 
                onClick={() => { setShowAuthModal(showAuthModal === 'login' ? 'register' : 'login'); setAuthError(''); }} 
                className="text-emerald-400 hover:underline"
              >
                {showAuthModal === 'login' ? 'Sign Up' : 'Log In'}
              </button>
            </p>
          </div>
        </div>
      )}

      {/* Add to Playlist Modal */}
      {showPlaylistModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] p-6 rounded-2xl w-96 border border-white/10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Add to Playlist</h3>
              <button onClick={() => { setShowPlaylistModal(false); setTrackToAdd(null); }} className="text-gray-400 hover:text-white"><X /></button>
            </div>
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
              {playlists.length === 0 ? (
                <p className="text-gray-400 text-sm">No playlists available. Create one in your Library.</p>
              ) : (
                playlists.map(playlist => (
                  <button 
                    key={playlist.id} 
                    onClick={() => addToPlaylist(playlist.id)}
                    className="text-left p-3 rounded-xl hover:bg-white/5 transition flex items-center gap-3"
                  >
                    <ListMusic size={18} className="text-emerald-400" />
                    {playlist.name}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Audio Element */}
      <audio
        ref={audioRef}
        src={audioUrl || undefined}
        onTimeUpdate={(e) => {
          setCurrentTime(e.currentTarget.currentTime);
          if (e.currentTarget.duration && e.currentTarget.duration !== duration) {
            setDuration(e.currentTarget.duration);
          }
        }}
        onEnded={() => setIsPlaying(false)}
        onError={(e) => {
          console.error("Audio error:", e);
          if (selectedTrack?.preview && audioUrl !== selectedTrack.preview) {
            console.log("Falling back to preview audio...");
            setAudioUrl(selectedTrack.preview);
            setIsPlaying(true);
          } else {
            setIsPlaying(false);
          }
        }}
      />

      {/* Player */}
      <footer className="fixed bottom-0 left-0 w-full bg-[#101010] border-t border-white/10 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4 w-64">
          {selectedTrack ? (
            <>
              <img src={selectedTrack.cover} alt={selectedTrack.title} referrerPolicy="no-referrer" className="w-12 h-12 rounded-lg" />
              <div>
                <p className="font-semibold truncate w-40">{selectedTrack.title}</p>
                <p className="text-sm text-gray-400 truncate w-40">
                  {selectedTrack.artist}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-12 h-12 bg-gray-800 rounded-lg"></div>
              <div>
                <p className="font-semibold">No song selected</p>
                <p className="text-sm text-gray-400">Select a song to play</p>
              </div>
            </>
          )}
        </div>
        <div className="flex flex-col items-center gap-2 flex-1 max-w-xl px-8">
          <div className="flex items-center gap-6">
            <SkipBack className={!audioUrl ? "text-gray-600" : "cursor-pointer hover:text-white transition"} />
            <button 
              onClick={togglePlay} 
              disabled={!audioUrl || isLoadingAudio}
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                audioUrl && !isLoadingAudio ? "bg-white text-black hover:scale-105 transition" : "bg-gray-800 text-gray-500 cursor-not-allowed"
              }`}
            >
              {isLoadingAudio ? <Loader2 className="animate-spin" /> : (isPlaying ? <Pause /> : <Play />)}
            </button>
            <SkipForward className={!audioUrl ? "text-gray-600" : "cursor-pointer hover:text-white transition"} />
            <Repeat className={!audioUrl ? "text-gray-600" : "cursor-pointer hover:text-white transition"} />
          </div>
          <div className="flex items-center gap-3 w-full">
            <span className="text-xs text-gray-400 w-10 text-right">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              disabled={!audioUrl}
              className="flex-1 h-1 bg-gray-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full disabled:cursor-not-allowed"
            />
            <span className="text-xs text-gray-400 w-10">{formatTime(duration)}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 w-64 justify-end">
          <Volume2 />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-24 h-1 bg-gray-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full"
          />
        </div>
      </footer>
    </div>
  );
}
