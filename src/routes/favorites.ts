import express from 'express';
import { getFavorites, addToFavorites, removeFromFavorites } from '../controllers/favoriteController';
import { auth, optionalAuth } from '../middleware/auth';

const router = express.Router();

// Favorites routes support both authenticated users (stored in DB) and guest users (handled client-side)
// For authenticated users, favorites are stored in database
// For guests, favorites are managed in localStorage on frontend
router.get('/', optionalAuth, getFavorites);
router.post('/add', optionalAuth, addToFavorites);
router.delete('/remove/:productId', optionalAuth, removeFromFavorites);

export default router;
