"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const emailService_1 = require("../services/emailService");
const prisma = new client_1.PrismaClient();
const router = express_1.default.Router();
router.post('/subscribe', [
    (0, express_validator_1.body)('email').isEmail().withMessage('Valid email is required')
], async (req, res) => {
    try {
        const { email } = req.body;
        const existingSubscriber = await prisma.newsletter.findUnique({
            where: { email: email.toLowerCase() }
        });
        if (existingSubscriber) {
            if (existingSubscriber.isActive) {
                return res.status(400).json({
                    success: false,
                    message: 'This email is already subscribed'
                });
            }
            else {
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
        await prisma.newsletter.create({
            data: {
                email: email.toLowerCase()
            }
        });
        const adminEmail = process.env.ADMIN_EMAIL || 'Info@southernsweetandsour.com';
        await (0, emailService_1.sendEmail)({
            to: adminEmail,
            subject: 'New Newsletter Subscriber',
            html: emailService_1.emailTemplates.newsletterSubscriptionNotification({ email: email.toLowerCase() })
        });
        await (0, emailService_1.sendEmail)({
            to: email,
            subject: 'Welcome to Southern Sweet and Sour Newsletter!',
            html: emailService_1.emailTemplates.newsletterConfirmation(email)
        });
        res.status(201).json({
            success: true,
            message: 'Successfully subscribed to newsletter'
        });
    }
    catch (error) {
        console.error('Newsletter subscribe error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.post('/unsubscribe', [
    (0, express_validator_1.body)('email').isEmail().withMessage('Valid email is required')
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
    }
    catch (error) {
        console.error('Newsletter unsubscribe error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.get('/', auth_1.auth, auth_1.adminAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        const isActive = req.query.isActive;
        const where = {};
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
    }
    catch (error) {
        console.error('Get subscribers error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.delete('/:id', auth_1.auth, auth_1.adminAuth, async (req, res) => {
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
    }
    catch (error) {
        console.error('Delete subscriber error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=newsletter.js.map