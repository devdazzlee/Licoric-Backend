"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProduct = exports.updateProduct = exports.createProduct = exports.getProductsByCategory = exports.searchProducts = exports.getProduct = exports.getProducts = void 0;
const client_1 = require("@prisma/client");
const cloudinary_1 = require("../utils/cloudinary");
const prisma = new client_1.PrismaClient();
const getProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const category = req.query.category;
        const sortBy = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder || 'desc';
        const minPrice = parseFloat(req.query.minPrice);
        const maxPrice = parseFloat(req.query.maxPrice);
        const where = {
            isActive: true,
            ...(category && { category }),
            ...(minPrice && maxPrice && {
                price: {
                    gte: minPrice,
                    lte: maxPrice
                }
            })
        };
        const orderBy = {};
        orderBy[sortBy] = sortOrder;
        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                orderBy,
                skip,
                take: limit,
                select: {
                    id: true,
                    name: true,
                    description: true,
                    shortDescription: true,
                    price: true,
                    originalPrice: true,
                    discount: true,
                    image: true,
                    images: true,
                    category: true,
                    brand: true,
                    sku: true,
                    rating: true,
                    reviewCount: true,
                    sales: true,
                    stock: true,
                    isActive: true,
                    createdAt: true
                }
            }),
            prisma.product.count({ where })
        ]);
        const totalPages = Math.ceil(total / limit);
        res.json({
            success: true,
            data: {
                products,
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
        console.error('Get products error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.getProducts = getProducts;
const getProduct = async (req, res) => {
    try {
        const product = await prisma.product.findUnique({
            where: { id: req.params.id },
            include: {
                reviews: {
                    where: { isActive: true },
                    include: {
                        user: {
                            select: {
                                firstName: true,
                                lastName: true
                            }
                        }
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 10
                }
            }
        });
        if (!product || !product.isActive) {
            res.status(404).json({
                success: false,
                message: 'Product not found'
            });
            return;
        }
        res.json({
            success: true,
            data: { product }
        });
    }
    catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.getProduct = getProduct;
const searchProducts = async (req, res) => {
    try {
        const query = req.query.q;
        const category = req.query.category;
        const minPrice = req.query.minPrice;
        const maxPrice = req.query.maxPrice;
        const sortBy = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder || 'desc';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const where = {
            isActive: true,
            ...(query && {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { description: { contains: query, mode: 'insensitive' } },
                    { brand: { contains: query, mode: 'insensitive' } }
                ]
            }),
            ...(category && { category }),
            ...(minPrice && maxPrice && {
                price: {
                    gte: parseFloat(minPrice),
                    lte: parseFloat(maxPrice)
                }
            })
        };
        const orderBy = {};
        orderBy[sortBy] = sortOrder;
        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                orderBy,
                skip,
                take: limit,
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
                    sales: true,
                    stock: true
                }
            }),
            prisma.product.count({ where })
        ]);
        const totalPages = Math.ceil(total / limit);
        res.json({
            success: true,
            data: {
                products,
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
        console.error('Search products error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.searchProducts = searchProducts;
const getProductsByCategory = async (req, res) => {
    try {
        const { category } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where: {
                    category: category,
                    isActive: true
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
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
                    sku: true,
                    rating: true,
                    reviewCount: true,
                    sales: true,
                    stock: true
                }
            }),
            prisma.product.count({
                where: {
                    category: category,
                    isActive: true
                }
            })
        ]);
        const totalPages = Math.ceil(total / limit);
        res.json({
            success: true,
            data: {
                products,
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
        console.error('Get products by category error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.getProductsByCategory = getProductsByCategory;
const createProduct = async (req, res) => {
    try {
        console.log('🔍 Create product request body:', req.body);
        console.log('📸 Image from request:', req.body.image);
        const { name, description, shortDescription, price, originalPrice, discount, category, brand, weight, ingredients, allergens, nutritionFacts, stock, sku, image: imageFromBody } = req.body;
        let image = imageFromBody || null;
        console.log('🖼️ Image value to use:', image);
        let images = [];
        if (req.file) {
            image = await (0, cloudinary_1.uploadToCloudinary)(req.file);
        }
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const uploadedImage = await (0, cloudinary_1.uploadToCloudinary)(file);
                images.push(uploadedImage);
            }
            if (!image && images.length > 0) {
                image = images[0];
            }
        }
        const finalImage = image || '';
        console.log('✨ Final image value for database:', finalImage);
        const product = await prisma.product.create({
            data: {
                name,
                description,
                shortDescription,
                price: parseFloat(price),
                originalPrice: originalPrice ? parseFloat(originalPrice) : null,
                discount: discount ? parseInt(discount) : null,
                image: finalImage,
                images,
                category,
                brand,
                weight,
                ingredients,
                allergens,
                nutritionFacts: nutritionFacts ? JSON.parse(nutritionFacts) : null,
                stock: parseInt(stock) || 0,
                sku
            }
        });
        console.log('✅ Product created with image:', product.image);
        res.status(201).json({
            success: true,
            message: 'Product created successfully',
            data: { product }
        });
    }
    catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.createProduct = createProduct;
const updateProduct = async (req, res) => {
    try {
        const { name, description, shortDescription, price, originalPrice, discount, category, brand, weight, ingredients, allergens, nutritionFacts, stock, sku, isActive } = req.body;
        const existingProduct = await prisma.product.findUnique({
            where: { id: req.params.id }
        });
        if (!existingProduct) {
            res.status(404).json({
                success: false,
                message: 'Product not found'
            });
            return;
        }
        let image = req.body.image || existingProduct.image;
        let images = existingProduct.images || [];
        if (req.file) {
            image = await (0, cloudinary_1.uploadToCloudinary)(req.file);
        }
        if (req.files && req.files.length > 0) {
            images = [];
            for (const file of req.files) {
                const uploadedImage = await (0, cloudinary_1.uploadToCloudinary)(file);
                images.push(uploadedImage);
            }
            if (!image && images.length > 0) {
                image = images[0];
            }
        }
        const updateData = {};
        if (name !== undefined)
            updateData.name = name;
        if (description !== undefined)
            updateData.description = description;
        if (shortDescription !== undefined)
            updateData.shortDescription = shortDescription;
        if (price !== undefined)
            updateData.price = parseFloat(price);
        if (originalPrice !== undefined)
            updateData.originalPrice = originalPrice ? parseFloat(originalPrice) : null;
        if (discount !== undefined)
            updateData.discount = discount ? parseInt(discount) : null;
        if (image !== undefined && image !== null && image !== '')
            updateData.image = image;
        if (images !== undefined)
            updateData.images = images;
        if (category !== undefined)
            updateData.category = category;
        if (brand !== undefined)
            updateData.brand = brand;
        if (weight !== undefined)
            updateData.weight = weight;
        if (ingredients !== undefined)
            updateData.ingredients = ingredients;
        if (allergens !== undefined)
            updateData.allergens = allergens;
        if (nutritionFacts !== undefined && nutritionFacts !== null && nutritionFacts !== '') {
            try {
                updateData.nutritionFacts = typeof nutritionFacts === 'string' ? JSON.parse(nutritionFacts) : nutritionFacts;
            }
            catch (e) {
            }
        }
        if (stock !== undefined)
            updateData.stock = parseInt(stock) || 0;
        if (sku !== undefined)
            updateData.sku = sku;
        if (isActive !== undefined) {
            if (typeof isActive === 'boolean') {
                updateData.isActive = isActive;
            }
            else if (typeof isActive === 'string') {
                updateData.isActive = isActive === 'true' || isActive === '1';
            }
            else {
                updateData.isActive = Boolean(isActive);
            }
        }
        const product = await prisma.product.update({
            where: { id: req.params.id },
            data: updateData
        });
        res.json({
            success: true,
            message: 'Product updated successfully',
            data: { product }
        });
    }
    catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.updateProduct = updateProduct;
const deleteProduct = async (req, res) => {
    try {
        const product = await prisma.product.findUnique({
            where: { id: req.params.id },
            include: {
                orderItems: {
                    select: { id: true }
                }
            }
        });
        if (!product) {
            res.status(404).json({
                success: false,
                message: 'Product not found'
            });
            return;
        }
        if (product.orderItems && product.orderItems.length > 0) {
            await prisma.product.update({
                where: { id: req.params.id },
                data: {
                    isActive: false
                }
            });
            res.json({
                success: true,
                message: 'Product deactivated successfully (cannot delete products with existing orders)',
                softDelete: true
            });
            return;
        }
        await prisma.product.delete({
            where: { id: req.params.id }
        });
        res.json({
            success: true,
            message: 'Product deleted successfully'
        });
    }
    catch (error) {
        console.error('Delete product error:', error);
        if (error.code === 'P2003') {
            res.status(400).json({
                success: false,
                message: 'Cannot delete product: It is referenced in existing orders. The product has been deactivated instead.',
                softDelete: true
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.deleteProduct = deleteProduct;
//# sourceMappingURL=productController.js.map