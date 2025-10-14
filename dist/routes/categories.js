"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const router = express_1.default.Router();
const categoryValidation = [
    (0, express_validator_1.body)('name').notEmpty().withMessage('Name is required'),
    (0, express_validator_1.body)('slug').notEmpty().withMessage('Slug is required'),
    (0, express_validator_1.body)('description').optional(),
    (0, express_validator_1.body)('image').optional(),
    (0, express_validator_1.body)('isActive').optional().isBoolean()
];
router.get('/', async (req, res) => {
    try {
        const isActive = req.query.isActive;
        const where = {};
        if (isActive !== undefined) {
            where.isActive = isActive === 'true';
        }
        const categories = await prisma.category.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });
        res.json({
            success: true,
            data: { categories }
        });
    }
    catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const category = await prisma.category.findUnique({
            where: { id }
        });
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }
        res.json({
            success: true,
            data: { category }
        });
    }
    catch (error) {
        console.error('Get category error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.post('/', auth_1.auth, auth_1.adminAuth, categoryValidation, async (req, res) => {
    try {
        const { name, slug, description, image, isActive } = req.body;
        const existingCategory = await prisma.category.findUnique({
            where: { slug }
        });
        if (existingCategory) {
            return res.status(400).json({
                success: false,
                message: 'Category with this slug already exists'
            });
        }
        const category = await prisma.category.create({
            data: {
                name,
                slug,
                description,
                image,
                isActive: isActive !== undefined ? isActive : true
            }
        });
        res.status(201).json({
            success: true,
            message: 'Category created successfully',
            data: { category }
        });
    }
    catch (error) {
        console.error('Create category error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.put('/:id', auth_1.auth, auth_1.adminAuth, categoryValidation, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, slug, description, image, isActive } = req.body;
        const category = await prisma.category.findUnique({
            where: { id }
        });
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }
        if (slug !== category.slug) {
            const existingCategory = await prisma.category.findUnique({
                where: { slug }
            });
            if (existingCategory) {
                return res.status(400).json({
                    success: false,
                    message: 'Category with this slug already exists'
                });
            }
        }
        const updatedCategory = await prisma.category.update({
            where: { id },
            data: {
                name,
                slug,
                description,
                image,
                isActive
            }
        });
        res.json({
            success: true,
            message: 'Category updated successfully',
            data: { category: updatedCategory }
        });
    }
    catch (error) {
        console.error('Update category error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.delete('/:id', auth_1.auth, auth_1.adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const category = await prisma.category.findUnique({
            where: { id }
        });
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }
        await prisma.category.delete({
            where: { id }
        });
        res.json({
            success: true,
            message: 'Category deleted successfully'
        });
    }
    catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=categories.js.map