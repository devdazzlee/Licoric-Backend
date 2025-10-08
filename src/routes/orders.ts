import express from 'express';
import { getOrders, getOrder, createOrder, updateOrderStatus, getUserOrders } from '../controllers/orderController';
import { auth, adminAuth } from '../middleware/auth';

const router = express.Router();

// User routes
router.get('/my-orders', auth, getUserOrders);
router.get('/:id', auth, getOrder);
router.post('/', auth, createOrder);

// Admin routes
router.get('/', auth, adminAuth, getOrders);
router.put('/:id/status', auth, adminAuth, updateOrderStatus);

export default router;
