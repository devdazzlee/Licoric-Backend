import express from 'express';
import { 
  submitWholesaleInquiry, 
  getWholesaleInquiries, 
  updateWholesaleInquiryStatus 
} from '../controllers/wholesaleController';
import { adminAuth } from '../middleware/auth';

const router = express.Router();

// Public routes
router.post('/inquiry', submitWholesaleInquiry);

// Admin routes
router.get('/inquiries', adminAuth, getWholesaleInquiries);
router.put('/inquiries/:id', adminAuth, updateWholesaleInquiryStatus);

export default router;
