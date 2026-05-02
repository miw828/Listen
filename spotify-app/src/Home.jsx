import { useEffect, useState } from 'react';
import {
  fetchCurrentlyPlaying,
  getAdminStats,
  saveCurrentTrack
} from '../supabase.js';
import './Home.css';
import Library from './Library.jsx';

// Home renders the Spotify connection flow, the current track, and the admin or user view.
export default function Home({ session, onConnectSpotify, onLogout }) {
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState('user');
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('listen-settings');
    return saved
      ? JSON.parse(saved)
      : {
          theme: 'system',
          color: 'green'
        };
  });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [adminStats, setAdminStats] = useState(null);
  const [page, setPage] = useState('home');
  const [likedSongs, setLikedSongs] = useState([]);

  const loggedIn = Boolean(session?.user);
  const libraryStorageKey = session?.user?.id ? `listen-library-${session.user.id}` : null;

  function mergeSongs(existingSongs, nextSongs) {
    const merged = new Map();

    [...existingSongs, ...nextSongs].forEach((song) => {
      if (song?.id) merged.set(song.id, song);
    });

    return Array.from(merged.values());
  }

  // This effect keeps the user's theme choices saved in local storage.
  useEffect(() => {
    localStorage.setItem('listen-settings', JSON.stringify(settings));
  }, [settings]);

  // This effect applies the selected theme and color mode to the page.
  useEffect(() => {
    document.body.dataset.theme = settings.theme;
    document.body.dataset.color = settings.color;
  }, [settings]);

  // This effect keeps the app library saved for the connected user.
  useEffect(() => {
    if (!libraryStorageKey) return;
    localStorage.setItem(libraryStorageKey, JSON.stringify(likedSongs));
  }, [likedSongs, libraryStorageKey]);

  // This effect refreshes the current track and admin stats while Spotify is connected.
  useEffect(() => {
    if (!loggedIn) return undefined;

    let active = true;

    // loadDashboard fetches the current song, saves it, refreshes account stats, and syncs the library.
    async function loadDashboard() {
      setLoading(true);
      setStatus('');

      try {
        const nowPlaying = await fetchCurrentlyPlaying();
        if (active) {
          setCurrentTrack(nowPlaying?.item ?? null);
        }

        const storedSongs = libraryStorageKey
          ? JSON.parse(localStorage.getItem(libraryStorageKey) ?? '[]')
          : [];
        await saveCurrentTrack();
        const stats = await getAdminStats();
        if (active) setAdminStats(stats);
        if (active) {
          setLikedSongs(storedSongs);
        }
      } catch (error) {
        if (active) setStatus(error.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDashboard();
    const interval = setInterval(loadDashboard, 30000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [loggedIn, libraryStorageKey]);

  // updateSetting applies theme and color changes from the settings controls.
  function updateSetting(event) {
    const { name, value } = event.target;
    setSettings((current) => ({ ...current, [name]: value }));
  }

  // handleSaveCurrentTrack saves the currently playing song to Spotify and refreshes the library view.
  async function handleSaveCurrentTrack() {
    if (!currentTrack?.id) {
      setStatus('There is no active track to save right now.');
      return;
    }

    try {
      setStatus('');
      setLikedSongs((current) => mergeSongs(current, [currentTrack]));
      setStatus('Saved to your library.');
    } catch (error) {
      setStatus(error.message);
    }
  }

  // handleRemoveSong removes a saved Spotify track and refreshes the library list.
  async function handleRemoveSong(trackId) {
    try {
      setStatus('');
      setLikedSongs((current) => current.filter((song) => song.id !== trackId));
      setStatus('Removed from your library.');
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <main className="home-shell" data-theme={settings.theme} data-color={settings.color}>
      <header className="topbar">
        <h1>Welcome to Listen!</h1>
        <nav className="topbar-actions" aria-label="Account actions">
          <button type="button" onClick={() => setPage('library')}>
            Library
          </button>
          <button type="button" onClick={() => setShowSettings((open) => !open)}>
            Settings
          </button>
          <button type="button" onClick={() => setPage('home')}>
               Home
          </button>
          {loggedIn ? (
            <button type="button" onClick={onLogout}>
              Log out
            </button>
          ) : (
            <button type="button" onClick={onConnectSpotify}>
              Connect to Spotify
            </button>
          )}
        </nav>
      </header>

      {showSettings && (
        <section className="panel" aria-label="Settings">
          <h2>Settings</h2>
          <div className="settings-grid">
            <label htmlFor="theme">Theme</label>
            <select id="theme" name="theme" value={settings.theme} onChange={updateSetting}>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>

            <label htmlFor="color">Color</label>
            <select id="color" name="color" value={settings.color} onChange={updateSetting}>
              <option value="green">Green</option>
              <option value="blue">Blue</option>
              <option value="pink">Pink</option>
            </select>
          </div>
        </section>
      )}

      {!loggedIn && (
        <section className="panel hero-panel">
          <h2>Connect to Spotify</h2>
          <p>Connect your Spotify account to see what you are listening to right now.</p>
          <button type="button" onClick={onConnectSpotify}>
            Connect to Spotify
          </button>
        </section>
      )}

      {loggedIn && (
        <>
          {page === 'library' ? (
            <Library
              likedSongs={likedSongs}
              loading={loading}
              onRemoveSong={handleRemoveSong}
            />
          ) : (
            <>
          <section className="panel" aria-label="Role view switcher">
            <h2>Choose View</h2>
            <div className="mode-switch">
              <button
                type="button"
                className={viewMode === 'admin' ? 'active' : ''}
                onClick={() => setViewMode('admin')}
              >
                Admin
              </button>
              <button
                type="button"
                className={viewMode === 'user' ? 'active' : ''}
                onClick={() => setViewMode('user')}
              >
                User
              </button>
            </div>
          </section>

          <section className="panel" aria-label="Currently playing">
            <h2>Your Spotify Right Now</h2>
            {loading && <p>Loading...</p>}
            {status && <p role="status">{status}</p>}
            {currentTrack ? (
              <article className="track-card">
                {currentTrack.album?.images?.[0]?.url && (
                  <img
                    className="album-art"
                    src={currentTrack.album.images[0].url}
                    alt={`${currentTrack.name} album art`}
                    width="120"
                    height="120"
                  />
                )}
                <h3>{currentTrack.name}</h3>
                <p>{currentTrack.artists?.map((artist) => artist.name).join(', ')}</p>
                <p>{currentTrack.album?.name}</p>
                <button type="button" onClick={handleSaveCurrentTrack}>
                  Like and save to library
                </button>
              </article>
            ) : (
              <p>Your Spotify account is connected, but nothing is playing right now.</p>
            )}
          </section>

          {viewMode === 'admin' && (
            <section className="panel" aria-label="Admin view">
              <h2>Admin</h2>
              <div className="stats-grid">
                <div className="stat-item">
                  <strong>Email</strong>
                  <span>{adminStats?.email ?? session?.user?.email ?? 'No email available'}</span>
                </div>
                <div className="stat-item">
                  <strong>Display Name</strong>
                  <span>{adminStats?.profile?.display_name ?? 'Not set'}</span>
                </div>
                <div className="stat-item">
                  <strong>Spotify Username</strong>
                  <span>{adminStats?.profile?.spotify_username ?? 'Not available'}</span>
                </div>
              
                
              </div>
            </section>
          )}
            </>
          )}
        </>
      )}
    </main>
  );
}
