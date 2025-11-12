import express from 'express';
import { getProducts, getProduct, createProduct, updateProduct, deleteProduct, searchProducts, getProductsByCategory } from '../controllers/productController';
import { auth, adminAuth } from '../middleware/auth';
import { upload, uploadToCloudinary } from '../utils/cloudinary';
import { AuthenticatedRequest } from '../types';
import { Response } from 'express';

const router = express.Router();

// Public routes
router.get('/', getProducts);
router.get('/search', searchProducts);
router.get('/category/:category', getProductsByCategory);
router.get('/:id', getProduct);

// Image upload route (removed auth temporarily for testing, add back in production)
router.post('/upload-image', upload.single('image'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
      return;
    }

    const imageUrl = await uploadToCloudinary(req.file);

    res.json({
      success: true,
      message: 'Image uploaded successfully',
      data: { imageUrl }
    });
  } catch (error: any) {
    console.error('Image upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload image'
    });
  }
});

// Admin routes
router.post('/', auth, adminAuth, createProduct);
router.put('/:id', auth, adminAuth, updateProduct);
router.delete('/:id', auth, adminAuth, deleteProduct);

export default router;


