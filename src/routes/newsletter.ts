import express from 'express';
import { body } from 'express-validator';
import { auth, adminAuth } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';
import { sendEmail, emailTemplates } from '../services/emailService';

const prisma = new PrismaClient();
const router = express.Router();

// @desc    Subscribe to newsletter (Public)
// @route   POST /api/newsletter/subscribe
// @access  Public
router.post('/subscribe', [
  body('email').isEmail().withMessage('Valid email is required')
], async (req, res) => {
  try {
    const { email } = req.body;

    // Check if email already exists
    const existingSubscriber = await prisma.newsletter.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingSubscriber) {
      if (existingSubscriber.isActive) {
        return res.status(400).json({
          success: false,
          message: 'This email is already subscribed'
        });
      } else {
        // Reactivate subscription
        await prisma.newsletter.update({
          where: { email: email.toLowerCase() },
          data: { isActive: true }
        });

        return res.json({
          success: true,
          message: 'Successfully resubscribed to newsletter'
        });
      }
    }

    // Create new subscriber
    await prisma.newsletter.create({
      data: {
        email: email.toLowerCase()
      }
    });

    // Send notification email to admin
    const adminEmail = process.env.ADMIN_EMAIL || 'Info@southernsweetandsour.com';
    await sendEmail({
      to: adminEmail,
      subject: 'New Newsletter Subscriber',
      html: emailTemplates.newsletterSubscriptionNotification({ email: email.toLowerCase() })
    });

    // Send confirmation email to subscriber
    await sendEmail({
      to: email,
      subject: 'Welcome to Southern Sweet and Sour Newsletter!',
      html: emailTemplates.newsletterConfirmation(email)
    });

    res.status(201).json({
      success: true,
      message: 'Successfully subscribed to newsletter'
    });
  } catch (error) {
    console.error('Newsletter subscribe error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Unsubscribe from newsletter (Public)
// @route   POST /api/newsletter/unsubscribe
// @access  Public
router.post('/unsubscribe', [
  body('email').isEmail().withMessage('Valid email is required')
], async (req, res) => {
  try {
    const { email } = req.body;

    const subscriber = await prisma.newsletter.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!subscriber) {
      return res.status(404).json({
        success: false,
        message: 'Email not found in newsletter list'
      });
    }

    await prisma.newsletter.update({
      where: { email: email.toLowerCase() },
      data: { isActive: false }
    });

    res.json({
      success: true,
      message: 'Successfully unsubscribed from newsletter'
    });
  } catch (error) {
    console.error('Newsletter unsubscribe error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get all subscribers (Admin)
// @route   GET /api/newsletter
// @access  Private/Admin
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;
    const isActive = req.query.isActive as string;

    const where: any = {};
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const [subscribers, total] = await Promise.all([
      prisma.newsletter.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.newsletter.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        subscribers,
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
    console.error('Get subscribers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Delete subscriber (Admin)
// @route   DELETE /api/newsletter/:id
// @access  Private/Admin
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const subscriber = await prisma.newsletter.findUnique({
      where: { id }
    });

    if (!subscriber) {
      return res.status(404).json({
        success: false,
        message: 'Subscriber not found'
      });
    }

    await prisma.newsletter.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Subscriber deleted successfully'
    });
  } catch (error) {
    console.error('Delete subscriber error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

export default router;





