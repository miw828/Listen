import { Router, json } from 'express';
import { getSupabase } from './db/supabaseServer.js';

const router = Router();
router.use(json());

const profileFields = 'id, spotify_username, display_name, avatar_url, created_at';
const listeningFields =
  'id, user_id, track_id, track_name, artist_name, album_art, listened_at';
const followFields = 'follower_id, following_id';

function sendSupabaseError(res, error, fallbackStatus = 500) {
  const status = Number(error?.status) || fallbackStatus;
  return res.status(status).json({ error: error.message });
}

function pickDefined(source = {}, fields) {
  return fields.reduce((values, field) => {
    if (source[field] !== undefined) values[field] = source[field];
    return values;
  }, {});
}

// profiles
router.get('/profiles', async (req, res) => {
  const supabase = getSupabase(req);
  const { data, error } = await supabase
    .from('profiles')
    .select(profileFields)
    .order('created_at', { ascending: false });

  if (error) return sendSupabaseError(res, error);
  return res.json(data);
});

router.get('/profiles/:id', async (req, res) => {
  const supabase = getSupabase(req);
  const { data, error } = await supabase
    .from('profiles')
    .select(profileFields)
    .eq('id', req.params.id)
    .maybeSingle();

  if (error) return sendSupabaseError(res, error);
  if (!data) return res.status(404).json({ error: 'Profile not found' });
  return res.json(data);
});

router.post('/profiles', async (req, res) => {
  const profile = pickDefined(req.body, [
    'id',
    'spotify_username',
    'display_name',
    'avatar_url'
  ]);

  if (!profile.id) {
    return res.status(400).json({ error: 'id is required' });
  }

  const supabase = getSupabase(req);
  const { data, error } = await supabase
    .from('profiles')
    .insert(profile)
    .select(profileFields)
    .single();

  if (error) return sendSupabaseError(res, error);
  return res.status(201).json(data);
});

router.patch('/profiles/:id', async (req, res) => {
  const updates = pickDefined(req.body, [
    'spotify_username',
    'display_name',
    'avatar_url'
  ]);

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No profile fields provided' });
  }

  const supabase = getSupabase(req);
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', req.params.id)
    .select(profileFields)
    .maybeSingle();

  if (error) return sendSupabaseError(res, error);
  if (!data) return res.status(404).json({ error: 'Profile not found' });
  return res.json(data);
});

// listening activity
router.get('/listening', async (req, res) => {
  const supabase = getSupabase(req);
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  let query = supabase
    .from('listening_activity')
    .select(listeningFields)
    .order('listened_at', { ascending: false })
    .limit(limit);

  if (req.query.user_id) {
    query = query.eq('user_id', req.query.user_id);
  }

  const { data, error } = await query;

  if (error) return sendSupabaseError(res, error);
  return res.json(data);
});

router.post('/listening', async (req, res) => {
  const activity = pickDefined(req.body, [
    'user_id',
    'track_id',
    'track_name',
    'artist_name',
    'album_art',
    'listened_at'
  ]);

  if (!activity.user_id || !activity.track_id) {
    return res.status(400).json({ error: 'user_id and track_id are required' });
  }

  const supabase = getSupabase(req);
  const { data, error } = await supabase
    .from('listening_activity')
    .insert(activity)
    .select(listeningFields)
    .single();

  if (error) return sendSupabaseError(res, error);
  return res.status(201).json(data);
});

router.delete('/listening/:id', async (req, res) => {
  const supabase = getSupabase(req);
  const { data, error } = await supabase
    .from('listening_activity')
    .delete()
    .eq('id', req.params.id)
    .select(listeningFields)
    .maybeSingle();

  if (error) return sendSupabaseError(res, error);
  if (!data) return res.status(404).json({ error: 'Listening activity not found' });
  return res.json({ message: 'Listening activity deleted', activity: data });
});

// follows
async function createFollow(req, res, follow) {
  if (!follow.follower_id || !follow.following_id) {
    return res
      .status(400)
      .json({ error: 'follower_id and following_id are required' });
  }

  if (follow.follower_id === follow.following_id) {
    return res.status(400).json({ error: 'A profile cannot follow itself' });
  }

  const supabase = getSupabase(req);
  const { data, error } = await supabase
    .from('follows')
    .insert(follow)
    .select(followFields)
    .single();

  if (error) return sendSupabaseError(res, error);
  return res.status(201).json(data);
}

router.get('/following', async (req, res) => {
  const supabase = getSupabase(req);
  let query = supabase.from('follows').select(followFields);

  if (req.query.follower_id) {
    query = query.eq('follower_id', req.query.follower_id);
  }

  const { data, error } = await query;

  if (error) return sendSupabaseError(res, error);
  return res.json(data);
});

router.post('/following', async (req, res) => {
  const follow = pickDefined(req.body, ['follower_id', 'following_id']);
  return createFollow(req, res, follow);
});

router.post('/following/:following_id', async (req, res) => {
  const follow = {
    follower_id: req.body?.follower_id,
    following_id: req.params.following_id
  };

  return createFollow(req, res, follow);
});

router.delete('/following/:following_id', async (req, res) => {
  const { follower_id: followerId } = req.body ?? {};
  const { following_id: followingId } = req.params;

  if (!followerId) {
    return res.status(400).json({ error: 'follower_id is required' });
  }

  const supabase = getSupabase(req);
  const { data, error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .select(followFields)
    .maybeSingle();

  if (error) return sendSupabaseError(res, error);
  if (!data) return res.status(404).json({ error: 'Follow not found' });
  return res.json({ message: 'Follow deleted', follow: data });
});

export default router;
