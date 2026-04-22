import {Router} from 'express';
import {query} from './db/postgres.js';

const router = Router();

//This will get all of the music from your Library GET /music 
router.get('/profiles', async (req, res) =>{
    try{
        const result = await query('SELECT * FROM profiles ORDER BY created_at DESC') //this should print out all of the profiles 
        res.json(result.rows);// actually prints it out
    } catch(err){
        res.status(500).json({error: err.message}); 
    }
})

//this will get the listening activity of your friends  
router.get('/listening', async (req, res) =>{
    try{
        const result = await query('SELECT * FROM listening_activity ORDER BY created_at DESC') //this should print out all of the profiles 
        res.json(result.rows);// actually prints it out
    } catch(err){
        res.status(500).json({error: err.message}); 
    }
})

router.get('/following', async (req, res) =>{
    try{
        const result = await query('SELECT * FROM follows ORDER BY created_at DESC') //this should print out all of the profiles 
        res.json(result.rows);// actually prints it out
    } catch(err){
        res.status(500).json({error: err.message}); 
    }
})

router.post('/profiles/:id'){
    const {id} = req.params; 
    const {spotify_username, display_name, avatar_url, created_at} = req.body;

    try{
        const result = await query(
            `UPDATE follows SET spotify_username =$1, display_name=$2, avatar_url=$3, created_at=$4 RETURNING *`, [spotify_username, display_name, avatar_url, created_at]
        );  if(result.rows.length === 0) return res.status(404).json({error: 'Job not found'})
            res.json(result.rows[0]);    
    }catch(err) {
res.status(500).json({error: err.message});
    }


}; 