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
const addressValidation = [
    (0, express_validator_1.body)('label').notEmpty().withMessage('Label is required'),
    (0, express_validator_1.body)('firstName').notEmpty().withMessage('First name is required'),
    (0, express_validator_1.body)('lastName').notEmpty().withMessage('Last name is required'),
    (0, express_validator_1.body)('address').notEmpty().withMessage('Address is required'),
    (0, express_validator_1.body)('city').notEmpty().withMessage('City is required'),
    (0, express_validator_1.body)('state').notEmpty().withMessage('State is required'),
    (0, express_validator_1.body)('zipCode').notEmpty().withMessage('Zip code is required'),
    (0, express_validator_1.body)('country').optional(),
    (0, express_validator_1.body)('phone').optional(),
    (0, express_validator_1.body)('isDefault').optional().isBoolean()
];
router.use(auth_1.auth);
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const addresses = await prisma.address.findMany({
            where: { userId },
            orderBy: [
                { isDefault: 'desc' },
                { createdAt: 'desc' }
            ]
        });
        res.json({
            success: true,
            data: { addresses }
        });
    }
    catch (error) {
        console.error('Get addresses error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const address = await prisma.address.findFirst({
            where: {
                id,
                userId
            }
        });
        if (!address) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }
        res.json({
            success: true,
            data: { address }
        });
    }
    catch (error) {
        console.error('Get address error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.post('/', addressValidation, async (req, res) => {
    try {
        const userId = req.user.id;
        const { label, firstName, lastName, phone, address, city, state, zipCode, country, isDefault } = req.body;
        if (isDefault) {
            await prisma.address.updateMany({
                where: { userId, isDefault: true },
                data: { isDefault: false }
            });
        }
        const addressCount = await prisma.address.count({
            where: { userId }
        });
        const newAddress = await prisma.address.create({
            data: {
                userId,
                label,
                firstName,
                lastName,
                phone,
                address,
                city,
                state,
                zipCode,
                country: country || 'USA',
                isDefault: isDefault || addressCount === 0
            }
        });
        res.status(201).json({
            success: true,
            message: 'Address created successfully',
            data: { address: newAddress }
        });
    }
    catch (error) {
        console.error('Create address error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.put('/:id', addressValidation, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { label, firstName, lastName, phone, address, city, state, zipCode, country, isDefault } = req.body;
        const existingAddress = await prisma.address.findFirst({
            where: { id, userId }
        });
        if (!existingAddress) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }
        if (isDefault && !existingAddress.isDefault) {
            await prisma.address.updateMany({
                where: { userId, isDefault: true },
                data: { isDefault: false }
            });
        }
        const updatedAddress = await prisma.address.update({
            where: { id },
            data: {
                label,
                firstName,
                lastName,
                phone,
                address,
                city,
                state,
                zipCode,
                country,
                isDefault
            }
        });
        res.json({
            success: true,
            message: 'Address updated successfully',
            data: { address: updatedAddress }
        });
    }
    catch (error) {
        console.error('Update address error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.patch('/:id/default', async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const address = await prisma.address.findFirst({
            where: { id, userId }
        });
        if (!address) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }
        await prisma.address.updateMany({
            where: { userId, isDefault: true },
            data: { isDefault: false }
        });
        const updatedAddress = await prisma.address.update({
            where: { id },
            data: { isDefault: true }
        });
        res.json({
            success: true,
            message: 'Default address updated',
            data: { address: updatedAddress }
        });
    }
    catch (error) {
        console.error('Set default address error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const address = await prisma.address.findFirst({
            where: { id, userId }
        });
        if (!address) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }
        await prisma.address.delete({
            where: { id }
        });
        if (address.isDefault) {
            const firstAddress = await prisma.address.findFirst({
                where: { userId },
                orderBy: { createdAt: 'asc' }
            });
            if (firstAddress) {
                await prisma.address.update({
                    where: { id: firstAddress.id },
                    data: { isDefault: true }
                });
            }
        }
        res.json({
            success: true,
            message: 'Address deleted successfully'
        });
    }
    catch (error) {
        console.error('Delete address error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=addresses.js.map