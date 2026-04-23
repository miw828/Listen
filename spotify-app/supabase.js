import { createClient } from '@supabase/supabase-js';

const viteEnv = import.meta.env ?? {};

const supabaseUrl =
  viteEnv.VITE_SUPABASE_URL ??
  viteEnv.NEXT_PUBLIC_SUPABASE_URL;

const supabaseKey =
  viteEnv.VITE_SUPABASE_PUBLISHABLE_KEY ??
  viteEnv.VITE_SUPABASE_ANON_KEY ??
  viteEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

const spotifyScopes = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-read-recently-played',
  'user-top-read',
  'user-library-modify'
].join(' ');

export const loginWithSpotify = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'spotify',
    options: { scopes: spotifyScopes }
  });
  if (error) throw error;
};

export const logout = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};
export const getCurrentSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
};

export const getCurrentUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
};

export const getSpotifyToken = async () => {
  const session = await getCurrentSession();
  return session?.provider_token;
};

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

export const fetchCurrentlyPlaying = async () => {
  return spotifyFetch('/me/player/currently-playing');
};

export const fetchRecentlyPlayed = async (limit = 10) => {
  return spotifyFetch(`/me/player/recently-played?limit=${limit}`);
};

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

export const saveTrackToSpotifyLibrary = async (trackId) => {
  await spotifyFetch(`/me/tracks?ids=${encodeURIComponent(trackId)}`, {
    method: 'PUT'
  });
};
