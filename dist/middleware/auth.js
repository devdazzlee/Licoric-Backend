"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminAuth = exports.optionalAuth = exports.auth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const auth = async (req, res, next) => {
    try {
        let token = req.cookies?.accessToken;
        if (!token) {
            const authHeader = req.header('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.replace('Bearer ', '');
            }
        }
        if (!token) {
            res.status(401).json({
                success: false,
                message: 'No token, authorization denied'
            });
            return;
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
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
                message: 'Token is not valid'
            });
            return;
        }
        req.user = user;
        next();
    }
    catch (error) {
        console.error('Auth middleware error:', error);
        res.status(401).json({
            success: false,
            message: 'Token is not valid'
        });
    }
};
exports.auth = auth;
const optionalAuth = async (req, res, next) => {
    try {
        let token = req.cookies?.accessToken;
        if (!token) {
            const authHeader = req.header('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.replace('Bearer ', '');
            }
        }
        if (!token) {
            next();
            return;
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
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
            if (user && user.isActive) {
                req.user = user;
            }
        }
        catch (error) {
            console.log('Optional auth: Invalid token, continuing as guest');
        }
        next();
    }
    catch (error) {
        console.error('Optional auth middleware error:', error);
        next();
    }
};
exports.optionalAuth = optionalAuth;
const adminAuth = async (req, res, next) => {
    try {
        await (0, exports.auth)(req, res, () => {
            if (req.user?.role !== 'ADMIN') {
                res.status(403).json({
                    success: false,
                    message: 'Access denied. Admin privileges required.'
                });
                return;
            }
            next();
        });
    }
    catch (error) {
        console.error('Admin auth middleware error:', error);
        res.status(403).json({
            success: false,
            message: 'Access denied'
        });
    }
};
exports.adminAuth = adminAuth;
//# sourceMappingURL=auth.js.map