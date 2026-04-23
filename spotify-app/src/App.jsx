import { useEffect, useState } from 'react';
import Home from './Home.jsx';
import { getCurrentSession, loginWithSpotify, logout, supabase } from '../supabase.js';

export default function App() {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const currentSession = await getCurrentSession();
        if (active) setSession(currentSession);
      } catch (error) {
        if (active) setStatus(error.message);
      }
    }

    loadSession();

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  async function handleLogin() {
    try {
      setStatus('');
      await loginWithSpotify();
    } catch (error) {
      setStatus(error.message);
    }
  }

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
      <Home session={session} onLogin={handleLogin} onLogout={handleLogout} />
    </>
  );
}
