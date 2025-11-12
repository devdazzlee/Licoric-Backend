import express from 'express';
import { 
  getUsers, 
  getUser, 
  updateUser, 
  deleteUser,
  getMyProfile,
  updateMyProfile,
  updateProfileImage,
  changePassword
} from '../controllers/userController';
import { auth, adminAuth } from '../middleware/auth';

const router = express.Router();

// User profile routes (must come before /:id routes)
router.get('/profile/me', auth, getMyProfile);
router.put('/profile/me', auth, updateMyProfile);
router.patch('/profile/image', auth, updateProfileImage);
router.put('/profile/password', auth, changePassword);

// Admin routes
router.get('/', auth, adminAuth, getUsers);
router.get('/:id', auth, adminAuth, getUser);
router.put('/:id', auth, adminAuth, updateUser);
router.delete('/:id', auth, adminAuth, deleteUser);

export default router;
