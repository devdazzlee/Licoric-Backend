"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeFromFavorites = exports.addToFavorites = exports.getFavorites = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getFavorites = async (req, res) => {
    try {
        const favorites = await prisma.favorite.findMany({
            where: { userId: req.user.id },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        price: true,
                        originalPrice: true,
                        discount: true,
                        image: true,
                        category: true,
                        brand: true,
                        rating: true,
                        reviewCount: true,
                        stock: true,
                        isActive: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        const activeFavorites = favorites.filter(fav => fav.product.isActive);
        res.json({
            success: true,
            data: { favorites: activeFavorites }
        });
    }
    catch (error) {
        console.error('Get favorites error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.getFavorites = getFavorites;
const addToFavorites = async (req, res) => {
    try {
        const { productId } = req.body;
        if (!productId) {
            res.status(400).json({
                success: false,
                message: 'Product ID is required'
            });
            return;
        }
        const product = await prisma.product.findUnique({
            where: { id: productId }
        });
        if (!product || !product.isActive) {
            res.status(404).json({
                success: false,
                message: 'Product not found or not available'
            });
            return;
        }
        const existingFavorite = await prisma.favorite.findUnique({
            where: {
                userId_productId: {
                    userId: req.user.id,
                    productId: productId
                }
            }
        });
        if (existingFavorite) {
            res.status(400).json({
                success: false,
                message: 'Product already in favorites'
            });
            return;
        }
        const favorite = await prisma.favorite.create({
            data: {
                userId: req.user.id,
                productId: productId
            },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        price: true,
                        originalPrice: true,
                        discount: true,
                        image: true,
                        category: true,
                        brand: true,
                        rating: true,
                        reviewCount: true,
                        stock: true
                    }
                }
            }
        });
        res.status(201).json({
            success: true,
            message: 'Product added to favorites successfully',
            data: { favorite }
        });
    }
    catch (error) {
        console.error('Add to favorites error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.addToFavorites = addToFavorites;
const removeFromFavorites = async (req, res) => {
    try {
        const { productId } = req.params;
        const favorite = await prisma.favorite.findUnique({
            where: {
                userId_productId: {
                    userId: req.user.id,
                    productId: productId
                }
            }
        });
        if (!favorite) {
            res.status(404).json({
                success: false,
                message: 'Product not found in favorites'
            });
            return;
        }
        await prisma.favorite.delete({
            where: {
                userId_productId: {
                    userId: req.user.id,
                    productId: productId
                }
            }
        });
        res.json({
            success: true,
            message: 'Product removed from favorites successfully'
        });
    }
    catch (error) {
        console.error('Remove from favorites error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.removeFromFavorites = removeFromFavorites;
//# sourceMappingURL=favoriteController.js.map