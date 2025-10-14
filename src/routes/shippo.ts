import express from 'express';
import { 
  validateShippingAddress, 
  getShippingRatesController, 
  createShipmentController, 
  shippoWebhook,
  calculateCheckoutRates 
} from '../controllers/shippoController';
import { auth } from '../middleware/auth';

const router = express.Router();

// Public routes (no auth required)
router.post('/webhook', shippoWebhook);
router.post('/calculate-rates', calculateCheckoutRates); // Public for guest checkout

// Protected routes (require authentication)
router.post('/validate-address', auth, validateShippingAddress);
router.post('/rates', auth, getShippingRatesController);
router.post('/create-shipment', auth, createShipmentController);

export default router;



