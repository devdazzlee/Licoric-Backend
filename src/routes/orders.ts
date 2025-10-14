import express from 'express';
import { getOrders, getOrder, createOrder, updateOrderStatus, getUserOrders } from '../controllers/orderController';
import { auth, adminAuth, optionalAuth } from '../middleware/auth';

const router = express.Router();

// User routes
router.get('/my-orders', auth, getUserOrders);
router.get('/:id', optionalAuth, getOrder); // Optional auth for guest order lookup
router.post('/', optionalAuth, createOrder); // Allow guest checkout

// Admin routes
router.get('/', auth, adminAuth, getOrders);
router.put('/:id/status', auth, adminAuth, updateOrderStatus);

export default router;


