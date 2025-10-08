import express from 'express';
import { body } from 'express-validator';
import { getContactMessages, createContactMessage, updateContactMessage, deleteContactMessage } from '../controllers/contactController';
import { auth, adminAuth } from '../middleware/auth';

const router = express.Router();

// Validation middleware
const contactValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('message').trim().isLength({ min: 10 }).withMessage('Message must be at least 10 characters')
];

// Public routes
router.post('/', contactValidation, createContactMessage);

// Admin routes
router.get('/', auth, adminAuth, getContactMessages);
router.put('/:id', auth, adminAuth, updateContactMessage);
router.delete('/:id', auth, adminAuth, deleteContactMessage);

export default router;
