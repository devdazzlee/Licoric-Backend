import express from 'express';
import { getProducts, getProduct, createProduct, updateProduct, deleteProduct, searchProducts, getProductsByCategory } from '../controllers/productController';
import { auth, adminAuth } from '../middleware/auth';

const router = express.Router();

// Public routes
router.get('/', getProducts);
router.get('/search', searchProducts);
router.get('/category/:category', getProductsByCategory);
router.get('/:id', getProduct);

// Admin routes
router.post('/', auth, adminAuth, createProduct);
router.put('/:id', auth, adminAuth, updateProduct);
router.delete('/:id', auth, adminAuth, deleteProduct);

export default router;
