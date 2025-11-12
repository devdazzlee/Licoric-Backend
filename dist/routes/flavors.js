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
const flavorValidation = [
    (0, express_validator_1.body)('name').notEmpty().withMessage('Name is required'),
    (0, express_validator_1.body)('description').optional(),
    (0, express_validator_1.body)('color').optional(),
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
        const flavors = await prisma.flavor.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });
        res.json({
            success: true,
            data: { flavors }
        });
    }
    catch (error) {
        console.error('Get flavors error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const flavor = await prisma.flavor.findUnique({
            where: { id }
        });
        if (!flavor) {
            return res.status(404).json({
                success: false,
                message: 'Flavor not found'
            });
        }
        res.json({
            success: true,
            data: { flavor }
        });
    }
    catch (error) {
        console.error('Get flavor error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.post('/', auth_1.auth, auth_1.adminAuth, flavorValidation, async (req, res) => {
    try {
        const { name, description, color, image, isActive } = req.body;
        const existingFlavor = await prisma.flavor.findUnique({
            where: { name }
        });
        if (existingFlavor) {
            return res.status(400).json({
                success: false,
                message: 'Flavor with this name already exists'
            });
        }
        const flavor = await prisma.flavor.create({
            data: {
                name,
                description,
                color,
                image,
                isActive: isActive !== undefined ? isActive : true
            }
        });
        res.status(201).json({
            success: true,
            message: 'Flavor created successfully',
            data: { flavor }
        });
    }
    catch (error) {
        console.error('Create flavor error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.put('/:id', auth_1.auth, auth_1.adminAuth, flavorValidation, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, color, image, isActive } = req.body;
        const flavor = await prisma.flavor.findUnique({
            where: { id }
        });
        if (!flavor) {
            return res.status(404).json({
                success: false,
                message: 'Flavor not found'
            });
        }
        if (name !== flavor.name) {
            const existingFlavor = await prisma.flavor.findUnique({
                where: { name }
            });
            if (existingFlavor) {
                return res.status(400).json({
                    success: false,
                    message: 'Flavor with this name already exists'
                });
            }
        }
        const updatedFlavor = await prisma.flavor.update({
            where: { id },
            data: {
                name,
                description,
                color,
                image,
                isActive
            }
        });
        res.json({
            success: true,
            message: 'Flavor updated successfully',
            data: { flavor: updatedFlavor }
        });
    }
    catch (error) {
        console.error('Update flavor error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.delete('/:id', auth_1.auth, auth_1.adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const flavor = await prisma.flavor.findUnique({
            where: { id }
        });
        if (!flavor) {
            return res.status(404).json({
                success: false,
                message: 'Flavor not found'
            });
        }
        await prisma.flavor.delete({
            where: { id }
        });
        res.json({
            success: true,
            message: 'Flavor deleted successfully'
        });
    }
    catch (error) {
        console.error('Delete flavor error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=flavors.js.map