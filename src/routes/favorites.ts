import express from 'express';
import { getFavorites, addToFavorites, removeFromFavorites } from '../controllers/favoriteController';
import { auth } from '../middleware/auth';

const router = express.Router();

// All favorites routes require authentication
router.use(auth);

// Routes
router.get('/', getFavorites);
router.post('/add', addToFavorites);
router.delete('/remove/:productId', removeFromFavorites);

export default router;
