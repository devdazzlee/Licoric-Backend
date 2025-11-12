import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { sendEmail, emailTemplates } from '../services/emailService';

const prisma = new PrismaClient();

// @desc    Get all contact messages (Admin)
// @route   GET /api/contact
// @access  Private/Admin
export const getContactMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status as string;

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [messages, total] = await Promise.all([
      prisma.contactMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.contactMessage.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        messages,
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
    console.error('Get contact messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Create contact message
// @route   POST /api/contact
// @access  Public
export const createContactMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, phone, subject, message } = req.body;

    const contactMessage = await prisma.contactMessage.create({
      data: {
        name,
        email,
        phone: phone || null,
        subject: subject || 'General Inquiry',
        message
      }
    });

    // Send notification email to admin
    const adminEmail = process.env.ADMIN_EMAIL || 'info@southernsweetandsour.com';
    await sendEmail({
      to: adminEmail,
      subject: `New Contact Form Submission: ${subject || 'General Inquiry'}`,
      html: emailTemplates.contactFormNotification({
        name,
        email,
        phone,
        subject: subject || 'General Inquiry',
        message
      })
    });

    // Send confirmation email to customer
    await sendEmail({
      to: email,
      subject: 'We received your message - Southern Sweet and Sour',
      html: emailTemplates.contactFormConfirmation({ name })
    });

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: { contactMessage }
    });
  } catch (error) {
    console.error('Create contact message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update contact message status (Admin)
// @route   PUT /api/contact/:id
// @access  Private/Admin
export const updateContactMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body;

    const message = await prisma.contactMessage.findUnique({
      where: { id: req.params.id }
    });

    if (!message) {
      res.status(404).json({
        success: false,
        message: 'Message not found'
      });
      return;
    }

    const updatedMessage = await prisma.contactMessage.update({
      where: { id: req.params.id },
      data: { status }
    });

    res.json({
      success: true,
      message: 'Message status updated successfully',
      data: { message: updatedMessage }
    });
  } catch (error) {
    console.error('Update contact message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete contact message (Admin)
// @route   DELETE /api/contact/:id
// @access  Private/Admin
export const deleteContactMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const message = await prisma.contactMessage.findUnique({
      where: { id: req.params.id }
    });

    if (!message) {
      res.status(404).json({
        success: false,
        message: 'Message not found'
      });
      return;
    }

    await prisma.contactMessage.delete({
      where: { id: req.params.id }
    });

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Delete contact message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
