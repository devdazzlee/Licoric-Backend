import express from 'express';
import { body } from 'express-validator';
import { getReviews, createReview, updateReview, deleteReview, getProductReviews } from '../controllers/reviewController';
import { auth, optionalAuth } from '../middleware/auth';

const router = express.Router();

// Validation middleware for authenticated reviews
const reviewValidation = [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').trim().isLength({ min: 10 }).withMessage('Comment must be at least 10 characters'),
  body('productId').notEmpty().withMessage('Product ID is required')
];

// Routes
router.get('/product/:productId', getProductReviews);
router.get('/', getReviews);
router.post('/', optionalAuth, reviewValidation, createReview); // Changed to optionalAuth for anonymous reviews
router.put('/:id', auth, reviewValidation, updateReview);
router.delete('/:id', auth, deleteReview);

export default router;


