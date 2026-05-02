import { useEffect, useState } from 'react'; //
import Home from './Home.jsx';
import {
  getFrontendConfigError,
  getCurrentSession,
  getSpotifySetupInstructions,
  loginWithSpotify,
  logout,
  supabase
} from '../supabase.js';
import { syncProfileFromSession } from '../supabase.js';
import './App.css';

export default function App() {
  const initialConfigError = getFrontendConfigError(); // will check if environment variables are there
  const setupInstructions = getSpotifySetupInstructions(); //
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState(
    initialConfigError ? `${initialConfigError} ${setupInstructions.join(' ')}` : ''
  );

  useEffect(() => {
    let active = true;

    if (initialConfigError) {
      return undefined;
    }

    async function loadSession() {
      try {
        const currentSession = await getCurrentSession();
        if (currentSession) {
          await syncProfileFromSession();
        }
        if (active) setSession(currentSession);
      } catch (error) {
        if (active) {
          setStatus(`${error.message} ${setupInstructions.join(' ')}`);
        }
      }
    }

    loadSession();

    const { data } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      try {
        if (nextSession) {
          await syncProfileFromSession();
        }
        setSession(nextSession);
      } catch (error) {
        setStatus(error.message);
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [initialConfigError, setupInstructions]);

  // handleConnectSpotify starts the Spotify OAuth flow for the current browser session.
  async function handleConnectSpotify() {
    try {
      setStatus('');
      await loginWithSpotify();
    } catch (error) {
      setStatus(`${error.message} ${getSpotifySetupInstructions().join(' ')}`);
    }
  }

  // handleLogout disconnects the current session from the app.
  async function handleLogout() {
    try {
      setStatus('');
      await logout();
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <>
      {status && <p role="alert">{status}</p>}
      <Home
        session={session}
        onConnectSpotify={handleConnectSpotify}
        onLogout={handleLogout}
      />
    </>
  );
}
