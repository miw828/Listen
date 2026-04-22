import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Login with Spotify
const loginWithSpotify = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'spotify',
    options: {
      scopes: 'user-read-currently-playing user-read-playback-state user-read-recently-played user-top-read',
    }
  })
  if (error) console.error(error)
}

// Logout
const logout = async () => {
  await supabase.auth.signOut()
}
const getSpotifyToken = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.provider_token  // ← This is your Spotify access token
}

const fetchCurrentlyPlaying = async () => {
  const token = await getSpotifyToken()

  const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  if (res.status === 204) return null  // Nothing playing
  return await res.json()
}

const fetchRecentlyPlayed = async () => {
  const token = await getSpotifyToken()

  const res = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=10', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  return await res.json()
}

const saveCurrentTrack = async () => { // this will save the track and the specific things that a user will save 
  const track = await fetchCurrentlyPlaying()
  if (!track?.item) return

  const { data: { user } } = await supabase.auth.getUser()

  await supabase.from('listening_activity').insert({
    user_id: user.id,
    track_id: track.item.id,
    track_name: track.item.name,
    artist_name: track.item.artists[0].name,
    album_art: track.item.album.images[0].url,
    listened_at: new Date().toISOString()
  })
}

// Poll every 30 seconds
useEffect(() => {
  saveCurrentTrack()
  const interval = setInterval(saveCurrentTrack, 30_000)
  return () => clearInterval(interval)
}, [])

const getFriendsFeed = async () => {
  const { data: { user } } = await supabase.auth.getUser()

  // Get who the user follows
  const { data: following } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id)

  const followingIds = following.map(f => f.following_id)

  // Get their recent listening activity
  const { data: feed } = await supabase
    .from('listening_activity')
    .select('*, profiles(display_name, avatar_url)')
    .in('user_id', followingIds)
    .order('listened_at', { ascending: false })
    .limit(50)

  return feed
}

// Get both tokens at login
const { data: { session } } = await supabase.auth.getSession()
const spotifyToken = session.provider_token
const spotifyRefreshToken = session.provider_refresh_token