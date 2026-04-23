import { useEffect, useState } from 'react';
import {
  commentOnActivity,
  getFriendsFeed,
  likeActivity,
  saveCurrentTrack,
  saveTrackToSpotifyLibrary,
  unlikeActivity
} from '../supabase.js';

export default function Home({ session, onLogin, onLogout }) {
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('listen-settings');
    return saved
      ? JSON.parse(saved)
      : {
          theme: 'system',
          color: 'green'
        };
  });
  const [feed, setFeed] = useState([]);
  const [comments, setComments] = useState({});
  const [liked, setLiked] = useState({});
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const loggedIn = Boolean(session?.user);

  useEffect(() => {
    localStorage.setItem('listen-settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!loggedIn) return undefined;

    let active = true;

    async function loadFeed() {
      setLoading(true);
      setStatus('');

      try {
        await saveCurrentTrack();
        const friendsFeed = await getFriendsFeed();
        if (active) setFeed(friendsFeed);
      } catch (error) {
        if (active) setStatus(error.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadFeed();
    const interval = setInterval(loadFeed, 30000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [loggedIn]);

  function updateSetting(event) {
    const { name, value } = event.target;
    setSettings((current) => ({ ...current, [name]: value }));
  }

  async function handleComment(activityId) {
    const body = comments[activityId]?.trim();
    if (!body) return;

    try {
      await commentOnActivity(activityId, body);
      setComments((current) => ({ ...current, [activityId]: '' }));
      setStatus('Comment posted.');
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function handleLike(activityId) {
    try {
      if (liked[activityId]) {
        await unlikeActivity(activityId);
        setLiked((current) => ({ ...current, [activityId]: false }));
        setStatus('Like removed.');
      } else {
        await likeActivity(activityId);
        setLiked((current) => ({ ...current, [activityId]: true }));
        setStatus('Liked.');
      }
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function handleSave(trackId) {
    try {
      await saveTrackToSpotifyLibrary(trackId);
      setStatus('Saved to your Spotify library.');
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <main data-theme={settings.theme} data-color={settings.color}>
      <header>
        <h1>Listen</h1>
        <nav aria-label="Account actions">
          <button type="button" onClick={() => setShowSettings((open) => !open)}>
            Settings
          </button>
          {loggedIn ? (
            <button type="button" onClick={onLogout}>
              Log out
            </button>
          ) : (
            <button type="button" onClick={onLogin}>
              Login / Sign up
            </button>
          )}
        </nav>
      </header>

      {showSettings && (
        <section aria-label="Settings">
          <h2>Settings</h2>
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
            <option value="yellow">Yellow</option>
          </select>
        </section>
      )}

      {!loggedIn && (
        <section>
          <h2>Home</h2>
          <p>Login or sign up with Spotify to see what your friends are listening to.</p>
        </section>
      )}

      {loggedIn && (
        <section aria-label="Friends listening feed">
          <h2>Friends Listening</h2>
          {loading && <p>Loading...</p>}
          {status && <p role="status">{status}</p>}
          {!loading && feed.length === 0 && <p>No friend activity yet.</p>}

          {feed.map((activity) => (
            <article key={activity.id}>
              {activity.album_art && (
                <img
                  src={activity.album_art}
                  alt={`${activity.track_name} album art`}
                  width="120"
                  height="120"
                />
              )}
              <h3>{activity.track_name}</h3>
              <p>{activity.artist_name}</p>
              <p>
                {activity.profiles?.display_name ?? 'A friend'} listened on{' '}
                {new Date(activity.listened_at).toLocaleString()}
              </p>

              <button type="button" onClick={() => handleLike(activity.id)}>
                {liked[activity.id] ? 'Unlike' : 'Like'}
              </button>
              <button type="button" onClick={() => handleSave(activity.track_id)}>
                Save to library
              </button>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  handleComment(activity.id);
                }}
              >
                <label htmlFor={`comment-${activity.id}`}>Comment</label>
                <input
                  id={`comment-${activity.id}`}
                  value={comments[activity.id] ?? ''}
                  onChange={(event) =>
                    setComments((current) => ({
                      ...current,
                      [activity.id]: event.target.value
                    }))
                  }
                />
                <button type="submit">Post</button>
              </form>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
