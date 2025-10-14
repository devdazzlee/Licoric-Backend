"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePassword = exports.updateProfileImage = exports.updateMyProfile = exports.getMyProfile = exports.deleteUser = exports.updateUser = exports.getUser = exports.getUsers = void 0;
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
const getUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    phone: true,
                    role: true,
                    isActive: true,
                    createdAt: true,
                    orders: {
                        select: {
                            id: true,
                            totalAmount: true,
                            status: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.user.count()
        ]);
        const usersWithStats = users.map(user => ({
            ...user,
            orderCount: user.orders.length,
            totalSpent: user.orders.reduce((sum, order) => sum + Number(order.totalAmount), 0)
        }));
        const totalPages = Math.ceil(total / limit);
        res.json({
            success: true,
            data: {
                users: usersWithStats,
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
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.getUsers = getUsers;
const getUser = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                address: true,
                city: true,
                state: true,
                zipCode: true,
                country: true,
                role: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
                orders: {
                    include: {
                        orderItems: {
                            include: {
                                product: {
                                    select: {
                                        id: true,
                                        name: true,
                                        image: true,
                                        price: true
                                    }
                                }
                            }
                        }
                    },
                    orderBy: { createdAt: 'desc' }
                },
                reviews: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                image: true
                            }
                        }
                    },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found'
            });
            return;
        }
        const userStats = {
            ...user,
            orderCount: user.orders.length,
            totalSpent: user.orders.reduce((sum, order) => sum + Number(order.totalAmount), 0),
            reviewCount: user.reviews.length,
            averageOrderValue: user.orders.length > 0
                ? user.orders.reduce((sum, order) => sum + Number(order.totalAmount), 0) / user.orders.length
                : 0
        };
        res.json({
            success: true,
            data: { user: userStats }
        });
    }
    catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.getUser = getUser;
const updateUser = async (req, res) => {
    try {
        const { email, firstName, lastName, phone, address, city, state, zipCode, country, role, isActive, password } = req.body;
        const existingUser = await prisma.user.findUnique({
            where: { id: req.params.id }
        });
        if (!existingUser) {
            res.status(404).json({
                success: false,
                message: 'User not found'
            });
            return;
        }
        const updateData = {
            ...(email && { email }),
            ...(firstName && { firstName }),
            ...(lastName && { lastName }),
            ...(phone && { phone }),
            ...(address && { address }),
            ...(city && { city }),
            ...(state && { state }),
            ...(zipCode && { zipCode }),
            ...(country && { country }),
            ...(role && { role }),
            ...(isActive !== undefined && { isActive })
        };
        if (password) {
            const salt = await bcryptjs_1.default.genSalt(10);
            updateData.password = await bcryptjs_1.default.hash(password, salt);
        }
        const user = await prisma.user.update({
            where: { id: req.params.id },
            data: updateData,
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                address: true,
                city: true,
                state: true,
                zipCode: true,
                country: true,
                role: true,
                isActive: true,
                updatedAt: true
            }
        });
        res.json({
            success: true,
            message: 'User updated successfully',
            data: { user }
        });
    }
    catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.updateUser = updateUser;
const deleteUser = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id }
        });
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found'
            });
            return;
        }
        if (user.role === 'ADMIN') {
            res.status(400).json({
                success: false,
                message: 'Cannot delete admin user'
            });
            return;
        }
        await prisma.user.delete({
            where: { id: req.params.id }
        });
        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    }
    catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.deleteUser = deleteUser;
const getMyProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                profileImage: true,
                address: true,
                city: true,
                state: true,
                zipCode: true,
                country: true,
                role: true,
                createdAt: true,
                updatedAt: true,
                addresses: {
                    orderBy: [
                        { isDefault: 'desc' },
                        { createdAt: 'desc' }
                    ]
                }
            }
        });
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found'
            });
            return;
        }
        res.json({
            success: true,
            data: { user }
        });
    }
    catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.getMyProfile = getMyProfile;
const updateMyProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { firstName, lastName, phone, profileImage, address, city, state, zipCode, country } = req.body;
        const updateData = {
            ...(firstName && { firstName }),
            ...(lastName && { lastName }),
            ...(phone && { phone }),
            ...(profileImage !== undefined && { profileImage }),
            ...(address && { address }),
            ...(city && { city }),
            ...(state && { state }),
            ...(zipCode && { zipCode }),
            ...(country && { country })
        };
        const user = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                profileImage: true,
                address: true,
                city: true,
                state: true,
                zipCode: true,
                country: true,
                role: true,
                updatedAt: true
            }
        });
        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: { user }
        });
    }
    catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.updateMyProfile = updateMyProfile;
const updateProfileImage = async (req, res) => {
    try {
        const userId = req.user.id;
        const { profileImage } = req.body;
        if (!profileImage) {
            res.status(400).json({
                success: false,
                message: 'Profile image URL is required'
            });
            return;
        }
        const user = await prisma.user.update({
            where: { id: userId },
            data: { profileImage },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                profileImage: true
            }
        });
        res.json({
            success: true,
            message: 'Profile image updated successfully',
            data: { user }
        });
    }
    catch (error) {
        console.error('Update profile image error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.updateProfileImage = updateProfileImage;
const changePassword = async (req, res) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            res.status(400).json({
                success: false,
                message: 'Current and new password are required'
            });
            return;
        }
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found'
            });
            return;
        }
        const isMatch = await bcryptjs_1.default.compare(currentPassword, user.password);
        if (!isMatch) {
            res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
            return;
        }
        const salt = await bcryptjs_1.default.genSalt(10);
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, salt);
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword }
        });
        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    }
    catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.changePassword = changePassword;
//# sourceMappingURL=userController.js.map