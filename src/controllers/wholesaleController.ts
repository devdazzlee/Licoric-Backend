import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { sendEmail, emailTemplates } from '../services/emailService';

const prisma = new PrismaClient();

// @desc    Submit wholesale inquiry
// @route   POST /api/wholesale/inquiry
// @access  Public
export const submitWholesaleInquiry = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      FirstName,
      LastName,
      email,
      phone,
      message,
    } = req.body;

    // Validate required fields
    if (!FirstName || !LastName || !email || !phone || !message) {
      res.status(400).json({
        success: false,
        message: 'Please fill in all required fields'
      });
      return;
    }

    // Create wholesale inquiry record
    const inquiry = await prisma.contactMessage.create({
      data: {
        name: `${FirstName} ${LastName}`,
        email: email,
        subject: `Wholesale Inquiry - ${FirstName} ${LastName}`,
        message: message,
        status: 'unread'
      }
    });

    // Send email notification to admin
    try {
      await sendEmail({
        to: process.env.ADMIN_EMAIL || 'Info@southernsweetandsour.com',
        subject: `New Wholesale Inquiry from ${FirstName} ${LastName}`,
        html: emailTemplates.wholesaleInquiry({
          FirstName,
          LastName,
          email,
          phone,
          message,
        })
      });
    } catch (emailError) {
      console.error('Failed to send wholesale inquiry email:', emailError);
      // Don't fail the request if email fails
    }

    // Send confirmation email to customer
    try {
      await sendEmail({
        to: email,
        subject: 'Wholesale Inquiry Received - Southern Sweet & Sour',
        html: emailTemplates.wholesaleConfirmation({
          FirstName,
          LastName,
          email,
          phone,
          message
        })
      });
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Wholesale inquiry submitted successfully',
      data: {
        inquiryId: inquiry.id,
        message: 'We will contact you within 24 hours with wholesale pricing and information.'
      }
    });

  } catch (error) {
    console.error('Wholesale inquiry error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing inquiry'
    });
  }
};

// @desc    Get all wholesale inquiries (Admin)
// @route   GET /api/wholesale/inquiries
// @access  Private/Admin
export const getWholesaleInquiries = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status as string;

    const where: any = {
      subject: {
        contains: 'Wholesale Inquiry'
      }
    };

    if (status) {
      where.status = status;
    }

    const [inquiries, total] = await Promise.all([
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
        inquiries,
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
    console.error('Get wholesale inquiries error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update wholesale inquiry status (Admin)
// @route   PUT /api/wholesale/inquiries/:id
// @access  Private/Admin
export const updateWholesaleInquiryStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['unread', 'read', 'replied'].includes(status)) {
      res.status(400).json({
        success: false,
        message: 'Invalid status. Must be unread, read, or replied'
      });
      return;
    }

    const inquiry = await prisma.contactMessage.update({
      where: { id },
      data: { status }
    });

    res.json({
      success: true,
      message: 'Inquiry status updated successfully',
      data: { inquiry }
    });
  } catch (error) {
    console.error('Update wholesale inquiry status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
