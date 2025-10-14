"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePassword = exports.updateProfile = exports.getProfile = exports.logout = exports.refreshAccessToken = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const express_validator_1 = require("express-validator");
const emailService_1 = require("../services/emailService");
const prisma = new client_1.PrismaClient();
const generateAccessToken = (id) => {
    return jsonwebtoken_1.default.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '15m'
    });
};
const generateRefreshToken = (id) => {
    return jsonwebtoken_1.default.sign({ id }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
        expiresIn: '7d'
    });
};
const accessTokenCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000
};
const refreshTokenCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth/refresh'
};
const register = async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
            return;
        }
        const { email, password, firstName, lastName, phone, address, city, state, zipCode, country } = req.body;
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });
        if (existingUser) {
            res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
            return;
        }
        const salt = await bcryptjs_1.default.genSalt(10);
        const hashedPassword = await bcryptjs_1.default.hash(password, salt);
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                firstName,
                lastName,
                phone,
                address,
                city,
                state,
                zipCode,
                country
            },
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
                createdAt: true
            }
        });
        const accessToken = generateAccessToken(user.id);
        const refreshToken = generateRefreshToken(user.id);
        res.cookie('accessToken', accessToken, accessTokenCookieOptions);
        res.cookie('refreshToken', refreshToken, refreshTokenCookieOptions);
        await (0, emailService_1.sendEmail)({
            to: user.email,
            subject: 'Welcome to Licorice Ropes!',
            html: emailService_1.emailTemplates.welcome(`${user.firstName || 'there'}`)
        }).catch(err => console.error('Failed to send welcome email:', err));
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                user,
                accessToken,
                refreshToken
            }
        });
    }
    catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during registration'
        });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
            return;
        }
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                email: true,
                password: true,
                firstName: true,
                lastName: true,
                phone: true,
                address: true,
                city: true,
                state: true,
                zipCode: true,
                country: true,
                role: true,
                isActive: true
            }
        });
        if (!user || !user.isActive) {
            res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
            return;
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.password);
        if (!isMatch) {
            res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
            return;
        }
        const { password: _, ...userWithoutPassword } = user;
        const accessToken = generateAccessToken(user.id);
        const refreshToken = generateRefreshToken(user.id);
        res.cookie('accessToken', accessToken, accessTokenCookieOptions);
        res.cookie('refreshToken', refreshToken, refreshTokenCookieOptions);
        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: userWithoutPassword,
                accessToken,
                refreshToken
            }
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login'
        });
    }
};
exports.login = login;
const refreshAccessToken = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
        if (!refreshToken) {
            res.status(401).json({
                success: false,
                message: 'Refresh token not provided'
            });
            return;
        }
        const decoded = jsonwebtoken_1.default.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true
            }
        });
        if (!user || !user.isActive) {
            res.status(401).json({
                success: false,
                message: 'Invalid refresh token'
            });
            return;
        }
        const newAccessToken = generateAccessToken(user.id);
        res.cookie('accessToken', newAccessToken, accessTokenCookieOptions);
        res.json({
            success: true,
            message: 'Access token refreshed successfully',
            data: {
                accessToken: newAccessToken,
                user
            }
        });
    }
    catch (error) {
        console.error('Refresh token error:', error);
        res.status(401).json({
            success: false,
            message: 'Invalid or expired refresh token'
        });
    }
};
exports.refreshAccessToken = refreshAccessToken;
const logout = async (req, res) => {
    try {
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    }
    catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during logout'
        });
    }
};
exports.logout = logout;
const getProfile = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
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
                createdAt: true,
                updatedAt: true
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
exports.getProfile = getProfile;
const updateProfile = async (req, res) => {
    try {
        const { firstName, lastName, phone, address, city, state, zipCode, country } = req.body;
        const user = await prisma.user.update({
            where: { id: req.user.id },
            data: {
                ...(firstName && { firstName }),
                ...(lastName && { lastName }),
                ...(phone && { phone }),
                ...(address && { address }),
                ...(city && { city }),
                ...(state && { state }),
                ...(zipCode && { zipCode }),
                ...(country && { country })
            },
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
exports.updateProfile = updateProfile;
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            res.status(400).json({
                success: false,
                message: 'Current password and new password are required'
            });
            return;
        }
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                password: true
            }
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
            where: { id: user.id },
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
//# sourceMappingURL=authController.js.map