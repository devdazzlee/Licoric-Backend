import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearProducts() {
  try {
    console.log('🗑️  Clearing all products...');

    // Delete all order items first (foreign key constraint)
    await prisma.orderItem.deleteMany({});
    console.log('✅ Cleared all order items');

    // Delete all reviews
    await prisma.review.deleteMany({});
    console.log('✅ Cleared all reviews');

    // Delete all cart items
    await prisma.cartItem.deleteMany({});
    console.log('✅ Cleared all cart items');

    // Delete all favorites
    await prisma.favorite.deleteMany({});
    console.log('✅ Cleared all favorites');

    // Delete all products
    await prisma.product.deleteMany({});
    console.log('✅ Cleared all products');

    console.log('🎉 All products and related data cleared successfully!');
  } catch (error) {
    console.error('❌ Error clearing products:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

clearProducts();




