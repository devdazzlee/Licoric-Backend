import express from 'express';
import { getCart, addToCart, updateCartItem, removeFromCart, clearCart } from '../controllers/cartController';
import { auth, optionalAuth } from '../middleware/auth';

const router = express.Router();

// Cart routes support both authenticated users (stored in DB) and guest users (handled client-side)
// For authenticated users, cart is stored in database
// For guests, cart is managed in localStorage/cookies on frontend
router.get('/', optionalAuth, getCart);
router.post('/add', optionalAuth, addToCart);
router.put('/update/:productId', optionalAuth, updateCartItem);
router.delete('/remove/:productId', optionalAuth, removeFromCart);
router.delete('/clear', optionalAuth, clearCart);

export default router;


