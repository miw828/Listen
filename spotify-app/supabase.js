import { createClient } from '@supabase/supabase-js';

const viteEnv = import.meta.env ?? {};
const defaultSpotifyScopes = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-read-recently-played',
  'user-top-read',
  'user-library-modify'
].join(' ');

const supabaseUrl = viteEnv.VITE_SUPABASE_URL ?? viteEnv.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey =
  viteEnv.VITE_SUPABASE_PUBLISHABLE_KEY ??
  viteEnv.VITE_SUPABASE_ANON_KEY ??
  viteEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  '';
const spotifyRedirectUri =
  viteEnv.VITE_SPOTIFY_REDIRECT_URI ?? `${window.location.origin}/`;
const spotifyScopes = viteEnv.VITE_SPOTIFY_SCOPES ?? defaultSpotifyScopes;

// getMissingFrontendConfig lists any Vite env values required before Spotify auth can work.
function getMissingFrontendConfig() {
  const missing = [];

  if (!supabaseUrl) missing.push('VITE_SUPABASE_URL');
  if (!supabaseKey) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  if (!spotifyRedirectUri) missing.push('VITE_SPOTIFY_REDIRECT_URI');

  return missing;
}

// assertFrontendConfig stops auth calls early if the frontend env is incomplete.
function assertFrontendConfig() {
  const missing = getMissingFrontendConfig();

  if (missing.length > 0) {
    throw new Error(`Missing frontend config: ${missing.join(', ')}`);
  }
}

// getFrontendConfigError returns a readable startup error for the UI.
export function getFrontendConfigError() {
  const missing = getMissingFrontendConfig();
  return missing.length > 0 ? `Missing frontend config: ${missing.join(', ')}` : '';
}

export const supabase =
  getMissingFrontendConfig().length === 0 ? createClient(supabaseUrl, supabaseKey) : null;
export const spotifyConfig = {
  redirectUri: spotifyRedirectUri,
  scopes: spotifyScopes
};

// getSpotifySetupInstructions gives setup guidance when auth configuration is missing.
export function getSpotifySetupInstructions() {
  return [
    'Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your Vite env file.',
    `Add VITE_SPOTIFY_REDIRECT_URI=${spotifyRedirectUri} to your Vite env file.`,
    'In Supabase Auth providers, enable Spotify and add your Spotify client ID and client secret there.',
    `In the Spotify developer dashboard, add ${spotifyRedirectUri} as an allowed redirect URI.`
  ];
}

// buildProfileFromUser maps Supabase auth metadata into the app's profile table shape.
function buildProfileFromUser(user) {
  const userMetadata = user?.user_metadata ?? {};
  const appMetadata = user?.app_metadata ?? {};

  return {
    id: user.id,
    spotify_username:
      userMetadata.preferred_username ??
      userMetadata.user_name ??
      appMetadata.provider ??
      null,
    display_name:
      userMetadata.full_name ||
      userMetadata.name ||
      userMetadata.preferred_username ||
      null,
    avatar_url: userMetadata.avatar_url ?? null
  };
}

// loginWithSpotify starts OAuth with the Spotify provider configured in Supabase.
export const loginWithSpotify = async () => {
  assertFrontendConfig();

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'spotify',
    options: {
      scopes: spotifyScopes,
      redirectTo: spotifyRedirectUri
    }
  });
  if (error) throw error;
};

// logout clears the current Supabase auth session in the browser.
export const logout = async () => {
  assertFrontendConfig();

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};
// getCurrentSession reads the active Supabase session from the browser.
export const getCurrentSession = async () => {
  assertFrontendConfig();

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
};

// getCurrentUser returns the authenticated Supabase user record.
export const getCurrentUser = async () => {
  assertFrontendConfig();

  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
};

// syncProfileFromSession upserts the connected Spotify user's profile into the database.
export const syncProfileFromSession = async () => {
  const user = await getCurrentUser();
  if (!user) return null;

  const profile = buildProfileFromUser(user);

  const { data, error } = await supabase
    .from('profiles')
    .upsert(profile, { onConflict: 'id' })
    .select()
    .single();

  if (error) throw error;

  return data;
};

// getAdminStats returns simple account details and listening totals for the connected user.
export const getAdminStats = async () => {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, spotify_username, display_name, avatar_url, created_at')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  const { count, error: countError } = await supabase
    .from('listening_activity')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (countError) throw countError;

  const { data: latestActivity, error: latestError } = await supabase
    .from('listening_activity')
    .select('track_name, artist_name, listened_at')
    .eq('user_id', user.id)
    .order('listened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) throw latestError;

  return {
    email: user.email ?? 'No email available',
    profile,
    totalTracksLogged: count ?? 0,
    latestActivity
  };
};

// getSpotifyToken pulls the provider access token out of the Supabase session.
export const getSpotifyToken = async () => {
  const session = await getCurrentSession();
  if (!session?.provider_token) {
    throw new Error(
      'Spotify is not fully connected yet. Add the Spotify client ID and secret in Supabase, then sign in again.'
    );
  }

  return session.provider_token;
};

// spotifyFetch sends authenticated requests to Spotify's Web API.
async function spotifyFetch(path, options = {}) {
  const token = await getSpotifyToken();

  if (!token) {
    throw new Error('Spotify login is required');
  }

  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {})
    }
  });

  if (response.status === 204) return null;
  if (!response.ok) throw new Error(`Spotify request failed: ${response.status}`);

  return response.json();
}

// fetchCurrentlyPlaying returns the track that Spotify says is playing right now.
export const fetchCurrentlyPlaying = async () => {
  return spotifyFetch('/me/player/currently-playing');
};

// fetchRecentlyPlayed loads the user's recent Spotify listening history.
export const fetchRecentlyPlayed = async (limit = 10) => {
  return spotifyFetch(`/me/player/recently-played?limit=${limit}`);
};

// saveCurrentTrack stores the active Spotify song in the listening_activity table.
export const saveCurrentTrack = async () => {
  const track = await fetchCurrentlyPlaying();
  if (!track?.item) return null;

  const user = await getCurrentUser();
  if (!user) return null;

  const activity = {
    user_id: user.id,
    track_id: track.item.id,
    track_name: track.item.name,
    artist_name: track.item.artists?.map((artist) => artist.name).join(', '),
    album_art: track.item.album?.images?.[0]?.url,
    listened_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('listening_activity')
    .insert(activity)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// getFriendsFeed returns recent listening activity for the users this account follows.
export const getFriendsFeed = async () => {
  const user = await getCurrentUser();
  if (!user) return [];

  // Get who the user follows
  const { data: following, error: followError } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id);

  if (followError) throw followError;

  const followingIds = following?.map((follow) => follow.following_id) ?? [];
  if (followingIds.length === 0) return [];

  // Get their recent listening activity
  const { data: feed, error } = await supabase
    .from('listening_activity')
    .select('*, profiles(display_name, avatar_url)')
    .in('user_id', followingIds)
    .order('listened_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return feed ?? [];
};

// commentOnActivity writes a new comment for a listening activity record.
export const commentOnActivity = async (activityId, body) => {
  const user = await getCurrentUser();
  if (!user) throw new Error('Login is required to comment');

  const { data, error } = await supabase
    .from('activity_comments')
    .insert({
      activity_id: activityId,
      user_id: user.id,
      body
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

// likeActivity records a like for a listening activity.
export const likeActivity = async (activityId) => {
  const user = await getCurrentUser();
  if (!user) throw new Error('Login is required to like music');

  const { data, error } = await supabase
    .from('activity_likes')
    .upsert({
      activity_id: activityId,
      user_id: user.id
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

// unlikeActivity removes the current user's like from a listening activity.
export const unlikeActivity = async (activityId) => {
  const user = await getCurrentUser();
  if (!user) throw new Error('Login is required to unlike music');

  const { error } = await supabase
    .from('activity_likes')
    .delete()
    .eq('activity_id', activityId)
    .eq('user_id', user.id);

  if (error) throw error;
};

// saveTrackToSpotifyLibrary sends a track from the app into the user's Spotify library.
export const saveTrackToSpotifyLibrary = async (trackId) => {
  await spotifyFetch(`/me/tracks?ids=${encodeURIComponent(trackId)}`, {
    method: 'PUT'
  });
};
