"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateContactMessage = exports.createContactMessage = exports.getContactMessages = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getContactMessages = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const status = req.query.status;
        const where = {};
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
    }
    catch (error) {
        console.error('Get contact messages error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.getContactMessages = getContactMessages;
const createContactMessage = async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;
        const contactMessage = await prisma.contactMessage.create({
            data: {
                name,
                email,
                subject: subject || 'General Inquiry',
                message
            }
        });
        res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            data: { contactMessage }
        });
    }
    catch (error) {
        console.error('Create contact message error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.createContactMessage = createContactMessage;
const updateContactMessage = async (req, res) => {
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
    }
    catch (error) {
        console.error('Update contact message error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.updateContactMessage = updateContactMessage;
//# sourceMappingURL=contactController.js.map