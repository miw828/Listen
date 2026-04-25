import { useEffect, useState } from 'react';
import {
  commentOnActivity,
  fetchCurrentlyPlaying,
  getFriendsFeed,
  likeActivity,
  saveCurrentTrack,
  saveTrackToSpotifyLibrary,
  unlikeActivity
} from '../supabase.js';
import './Home.css'; 

// Home renders the connect flow, current track, and social activity for the connected user.
export default function Home({ session, onConnectSpotify, onLogout }) {
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
  const [currentTrack, setCurrentTrack] = useState(null);

  const loggedIn = Boolean(session?.user);

  // This effect keeps the user's theme choices saved in local storage.
  useEffect(() => {
    localStorage.setItem('listen-settings', JSON.stringify(settings));
  }, [settings]);

  // This effect refreshes the current track and the friends feed while Spotify is connected.
  useEffect(() => {
    if (!loggedIn) return undefined;

    let active = true;

    // loadFeed fetches the user's current song, stores it, and refreshes friend activity.
    async function loadFeed() {
      setLoading(true);
      setStatus('');

      try {
        const nowPlaying = await fetchCurrentlyPlaying();
        if (active) {
          setCurrentTrack(nowPlaying?.item ?? null);
        }

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

  // updateSetting applies theme and color changes from the settings controls.
  function updateSetting(event) {
    const { name, value } = event.target;
    setSettings((current) => ({ ...current, [name]: value }));
  }

  // handleComment posts a comment for one activity card.
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

  // handleLike toggles the like state for a friend's listening activity.
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

  // handleSave adds a track from the feed to the user's Spotify library.
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
        <h1>Welcome to Listen!</h1>
        <nav aria-label="Account actions">
          <button type="button" onClick={() => setShowSettings((open) => !open)}>
            Settings
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
          <h2>Connect to Spotify</h2>
          <p>Connect your Spotify account to see what you are listening to right now.</p>
          <button type="button" onClick={onConnectSpotify}>
            Connect to Spotify
          </button>
        </section>
      )}

      {loggedIn && (
        <>
          <section aria-label="Currently playing">
            <h2>Your Spotify Right Now</h2>
            {currentTrack ? (
              <article>
                {currentTrack.album?.images?.[0]?.url && (
                  <img
                    src={currentTrack.album.images[0].url}
                    alt={`${currentTrack.name} album art`}
                    width="120"
                    height="120"
                  />
                )}
                <h3>{currentTrack.name}</h3>
                <p>{currentTrack.artists?.map((artist) => artist.name).join(', ')}</p>
                <p>{currentTrack.album?.name}</p>
              </article>
            ) : (
              <p>Your Spotify account is connected, but nothing is playing right now.</p>
            )}
          </section>

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
        </>
      )}
    </main>
  );
}
