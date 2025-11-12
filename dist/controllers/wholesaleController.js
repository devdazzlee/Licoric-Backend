"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateWholesaleInquiryStatus = exports.getWholesaleInquiries = exports.submitWholesaleInquiry = void 0;
const client_1 = require("@prisma/client");
const emailService_1 = require("../services/emailService");
const prisma = new client_1.PrismaClient();
const submitWholesaleInquiry = async (req, res) => {
    try {
        const { FirstName, LastName, email, phone, message, } = req.body;
        if (!FirstName || !LastName || !email || !phone || !message) {
            res.status(400).json({
                success: false,
                message: 'Please fill in all required fields'
            });
            return;
        }
        const inquiry = await prisma.contactMessage.create({
            data: {
                name: `${FirstName} ${LastName}`,
                email: email,
                subject: `Wholesale Inquiry - ${FirstName} ${LastName}`,
                message: message,
                status: 'unread'
            }
        });
        try {
            await (0, emailService_1.sendEmail)({
                to: process.env.ADMIN_EMAIL || 'Info@southernsweetandsour.com',
                subject: `New Wholesale Inquiry from ${FirstName} ${LastName}`,
                html: emailService_1.emailTemplates.wholesaleInquiry({
                    FirstName,
                    LastName,
                    email,
                    phone,
                    message,
                })
            });
        }
        catch (emailError) {
            console.error('Failed to send wholesale inquiry email:', emailError);
        }
        try {
            await (0, emailService_1.sendEmail)({
                to: email,
                subject: 'Wholesale Inquiry Received - Southern Sweet & Sour',
                html: emailService_1.emailTemplates.wholesaleConfirmation({
                    FirstName,
                    LastName,
                    email,
                    phone,
                    message
                })
            });
        }
        catch (emailError) {
            console.error('Failed to send confirmation email:', emailError);
        }
        res.status(201).json({
            success: true,
            message: 'Wholesale inquiry submitted successfully',
            data: {
                inquiryId: inquiry.id,
                message: 'We will contact you within 24 hours with wholesale pricing and information.'
            }
        });
    }
    catch (error) {
        console.error('Wholesale inquiry error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while processing inquiry'
        });
    }
};
exports.submitWholesaleInquiry = submitWholesaleInquiry;
const getWholesaleInquiries = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const status = req.query.status;
        const where = {
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
    }
    catch (error) {
        console.error('Get wholesale inquiries error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.getWholesaleInquiries = getWholesaleInquiries;
const updateWholesaleInquiryStatus = async (req, res) => {
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
    }
    catch (error) {
        console.error('Update wholesale inquiry status error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.updateWholesaleInquiryStatus = updateWholesaleInquiryStatus;
//# sourceMappingURL=wholesaleController.js.map