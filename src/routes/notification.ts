import express from 'express';
import { body } from 'express-validator';
import { auth, adminAuth } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';
import { getNotificationStats, markAllNotificationsAsRead } from '../services/socketService';
import { AuthenticatedRequest } from '../types';
import { Response } from 'express';

const prisma = new PrismaClient();
const router = express.Router();

// Validation middleware
const createNotificationValidation = [
  body('userId').notEmpty().withMessage('User ID is required'),
  body('title').notEmpty().withMessage('Title is required'),
  body('message').notEmpty().withMessage('Message is required'),
  body('type').isIn(['ORDER', 'PAYMENT', 'SHIPMENT', 'REVIEW', 'GENERAL', 'PROMOTION', 'SYSTEM']).withMessage('Invalid notification type')
];

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
router.get('/', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const unreadOnly = req.query.unreadOnly === 'true';

    const where: any = { userId: req.user!.id };
    if (unreadOnly) {
      where.read = false;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.notification.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          itemsPerPage: limit,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
router.put('/:id/read', auth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.findUnique({
      where: { id }
    });

    if (!notification) {
      res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
      return;
    }

    if (notification.userId !== req.user!.id) {
      res.status(403).json({
        success: false,
        message: 'Access denied'
      });
      return;
    }

    await prisma.notification.update({
      where: { id },
      data: { read: true }
    });

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/mark-all-read
// @access  Private
router.put('/mark-all-read', auth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await markAllNotificationsAsRead(req.user!.id);

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
router.get('/unread-count', auth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const count = await prisma.notification.count({
      where: {
        userId: req.user!.id,
        read: false
      }
    });

    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Create notification (Admin)
// @route   POST /api/notifications
// @access  Private/Admin
router.post('/', auth, adminAuth, createNotificationValidation, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId, title, message, type, relatedId, data } = req.body;

    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        relatedId,
        data
      }
    });

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      data: { notification }
    });
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get all notifications (Admin)
// @route   GET /api/notifications/admin
// @access  Private/Admin
router.get('/admin', auth, adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const type = req.query.type as string;
    const unreadOnly = req.query.unreadOnly === 'true';

    const where: any = {};
    if (type) where.type = type;
    if (unreadOnly) where.read = false;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.notification.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          itemsPerPage: limit,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get admin notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get notification statistics (Admin)
// @route   GET /api/notifications/stats
// @access  Private/Admin
router.get('/stats', auth, adminAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const stats = await getNotificationStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get notification stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Send broadcast notification (Admin)
// @route   POST /api/notifications/broadcast
// @access  Private/Admin
router.post('/broadcast', auth, adminAuth, async (req, res) => {
  try {
    const { title, message, type = 'GENERAL' } = req.body;

    // Get all active users
    const users = await prisma.user.findMany({
      where: { isActive: true }
    });

    // Create notifications for all users
    const notifications = await Promise.all(
      users.map(user =>
        prisma.notification.create({
          data: {
            userId: user.id,
            title,
            message,
            type,
            data: { broadcast: true }
          }
        })
      )
    );

    res.json({
      success: true,
      message: `Broadcast notification sent to ${users.length} users`,
      data: { sentCount: notifications.length }
    });
  } catch (error) {
    console.error('Broadcast notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
router.delete('/:id', auth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.findUnique({
      where: { id }
    });

    if (!notification) {
      res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
      return;
    }

    if (notification.userId !== req.user!.id && req.user!.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Access denied'
      });
      return;
    }

    await prisma.notification.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Bulk mark notifications as read (Admin)
// @route   PUT /api/notifications/bulk-read
// @access  Private/Admin
router.put('/bulk-read', auth, adminAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { notificationIds } = req.body;

    if (!Array.isArray(notificationIds)) {
      res.status(400).json({
        success: false,
        message: 'Notification IDs must be an array'
      });
      return;
    }

    await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds }
      },
      data: { read: true }
    });

    res.json({
      success: true,
      message: `${notificationIds.length} notifications marked as read`
    });
  } catch (error) {
    console.error('Bulk mark notifications as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

export default router;
