"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function clearProducts() {
    try {
        console.log('🗑️  Clearing all products...');
        await prisma.orderItem.deleteMany({});
        console.log('✅ Cleared all order items');
        await prisma.review.deleteMany({});
        console.log('✅ Cleared all reviews');
        await prisma.cartItem.deleteMany({});
        console.log('✅ Cleared all cart items');
        await prisma.favorite.deleteMany({});
        console.log('✅ Cleared all favorites');
        await prisma.product.deleteMany({});
        console.log('✅ Cleared all products');
        console.log('🎉 All products and related data cleared successfully!');
    }
    catch (error) {
        console.error('❌ Error clearing products:', error);
        process.exit(1);
    }
    finally {
        await prisma.$disconnect();
    }
}
clearProducts();
//# sourceMappingURL=clearProducts.js.map