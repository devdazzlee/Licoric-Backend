import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const seedData = async (): Promise<void> => {
  try {
    console.log('🌱 Starting database seed...');

    // Clear existing data
    await prisma.review.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.favorite.deleteMany();
    await prisma.cartItem.deleteMany();
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();
    await prisma.contactMessage.deleteMany();
    await prisma.newsletter.deleteMany();

    console.log('🗑️  Cleared existing data');

    // Create admin user
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
    
    const adminUser = await prisma.user.create({
      data: {
        email: process.env.ADMIN_EMAIL || 'admin@licoriceropes.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        phone: '+1 (555) 123-4567',
        address: '123 Candy Lane',
        city: 'Sweet City',
        state: 'SC',
        zipCode: '12345',
        country: 'USA'
      }
    });

    console.log('👤 Created admin user');

    // Create sample customer users
    const customerPassword = await bcrypt.hash('password123', 10);
    
    const customers = await Promise.all([
      prisma.user.create({
        data: {
          email: 'john.doe@example.com',
          password: customerPassword,
          firstName: 'John',
          lastName: 'Doe',
          role: 'CUSTOMER',
          phone: '+1 (555) 111-1111',
          address: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          country: 'USA'
        }
      }),
      prisma.user.create({
        data: {
          email: 'jane.smith@example.com',
          password: customerPassword,
          firstName: 'Jane',
          lastName: 'Smith',
          role: 'CUSTOMER',
          phone: '+1 (555) 222-2222',
          address: '456 Oak Ave',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '90210',
          country: 'USA'
        }
      })
    ]);

    console.log('👥 Created sample customers');

    // Create sample products
    const products = await Promise.all([
      prisma.product.create({
        data: {
          name: 'Sour Cherry Licorice Ropes',
          description: 'A classic candy with a bold twist, featuring rich sour cherry flavor made from natural ingredients for an intense, aromatic taste that will satisfy your sweet cravings.',
          shortDescription: 'Classic sour cherry licorice with bold flavor',
          price: 4.99,
          originalPrice: 6.99,
          discount: 29,
          image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=500',
          images: [
            'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=500',
            'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=500'
          ],
          category: 'Sour',
          brand: 'Southern Sweet',
          weight: '80g',
          ingredients: 'Corn Syrup, Wheat flour, sugar, modified corn starch, Licorice extract, palm and coconut oil, salt, glycerin, mono and diglycerides, artificial flavors, colors: Caramel',
          allergens: 'Contains: Wheat (gluten). May contain traces of Soy.',
          nutritionFacts: {
            servingsPerContainer: '3 Servings per container',
            servingSize: '1/3 Pieces (27g)',
            amountPerServing: 'Amount per serving',
            calories: 100,
            totalFat: 0.3,
            sodium: 20,
            totalCarbohydrate: 21,
            totalSugars: 12,
            addedSugars: 12,
            protein: 12
          },
          stock: 100,
          sku: 'LR-SC-001',
          rating: 4.8,
          reviewCount: 25,
          sales: 150
        }
      }),
      prisma.product.create({
        data: {
          name: 'Blue Raspberry Licorice Ropes',
          description: 'Experience the perfect balance of sweet and tangy with our blue raspberry licorice ropes. Made with premium ingredients for an authentic fruit flavor.',
          shortDescription: 'Sweet and tangy blue raspberry licorice',
          price: 5.99,
          originalPrice: 7.99,
          discount: 25,
          image: 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=500',
          images: [
            'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=500',
            'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=500'
          ],
          category: 'Sweet',
          brand: 'Southern Sweet',
          weight: '80g',
          ingredients: 'Corn Syrup, Wheat flour, sugar, modified corn starch, Licorice extract, palm and coconut oil, salt, glycerin, mono and diglycerides, artificial flavors, colors: Blue 1',
          allergens: 'Contains: Wheat (gluten). May contain traces of Soy.',
          nutritionFacts: {
            servingsPerContainer: '3 Servings per container',
            servingSize: '1/3 Pieces (27g)',
            amountPerServing: 'Amount per serving',
            calories: 105,
            totalFat: 0.3,
            sodium: 20,
            totalCarbohydrate: 22,
            totalSugars: 13,
            addedSugars: 13,
            protein: 12
          },
          stock: 85,
          sku: 'LR-BR-002',
          rating: 4.6,
          reviewCount: 18,
          sales: 120
        }
      }),
      prisma.product.create({
        data: {
          name: 'Green Apple Licorice Ropes',
          description: 'Crisp and refreshing green apple flavor in every bite. Our green apple licorice ropes offer a delightful combination of sweetness and tartness.',
          shortDescription: 'Crisp and refreshing green apple flavor',
          price: 4.49,
          image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=500',
          images: [
            'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=500'
          ],
          category: 'Sour',
          brand: 'Southern Sweet',
          weight: '80g',
          ingredients: 'Corn Syrup, Wheat flour, sugar, modified corn starch, Licorice extract, palm and coconut oil, salt, glycerin, mono and diglycerides, artificial flavors, colors: Green 3',
          allergens: 'Contains: Wheat (gluten). May contain traces of Soy.',
          nutritionFacts: {
            servingsPerContainer: '3 Servings per container',
            servingSize: '1/3 Pieces (27g)',
            amountPerServing: 'Amount per serving',
            calories: 98,
            totalFat: 0.3,
            sodium: 20,
            totalCarbohydrate: 21,
            totalSugars: 12,
            addedSugars: 12,
            protein: 12
          },
          stock: 120,
          sku: 'LR-GA-003',
          rating: 4.7,
          reviewCount: 32,
          sales: 200
        }
      }),
      prisma.product.create({
        data: {
          name: 'Cotton Candy Licorice Ropes',
          description: 'Experience the whimsical flavor of cotton candy in our soft and chewy licorice ropes. A perfect treat for cotton candy lovers.',
          shortDescription: 'Whimsical cotton candy flavor',
          price: 5.49,
          originalPrice: 6.99,
          discount: 21,
          image: 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=500',
          images: [
            'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=500'
          ],
          category: 'Sweet',
          brand: 'Southern Sweet',
          weight: '80g',
          ingredients: 'Corn Syrup, Wheat flour, sugar, modified corn starch, Licorice extract, palm and coconut oil, salt, glycerin, mono and diglycerides, artificial flavors, colors: Red 40, Blue 1',
          allergens: 'Contains: Wheat (gluten). May contain traces of Soy.',
          nutritionFacts: {
            servingsPerContainer: '3 Servings per container',
            servingSize: '1/3 Pieces (27g)',
            amountPerServing: 'Amount per serving',
            calories: 102,
            totalFat: 0.3,
            sodium: 20,
            totalCarbohydrate: 21,
            totalSugars: 12,
            addedSugars: 12,
            protein: 12
          },
          stock: 75,
          sku: 'LR-CC-004',
          rating: 4.5,
          reviewCount: 15,
          sales: 90
        }
      }),
      prisma.product.create({
        data: {
          name: 'Watermelon Licorice Ropes',
          description: 'Juicy watermelon flavor that bursts with sweetness. Our watermelon licorice ropes are perfect for summer snacking.',
          shortDescription: 'Juicy watermelon flavor',
          price: 4.99,
          image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=500',
          images: [
            'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=500'
          ],
          category: 'Sweet',
          brand: 'Southern Sweet',
          weight: '80g',
          ingredients: 'Corn Syrup, Wheat flour, sugar, modified corn starch, Licorice extract, palm and coconut oil, salt, glycerin, mono and diglycerides, artificial flavors, colors: Red 40, Green 3',
          allergens: 'Contains: Wheat (gluten). May contain traces of Soy.',
          nutritionFacts: {
            servingsPerContainer: '3 Servings per container',
            servingSize: '1/3 Pieces (27g)',
            amountPerServing: 'Amount per serving',
            calories: 100,
            totalFat: 0.3,
            sodium: 20,
            totalCarbohydrate: 21,
            totalSugars: 12,
            addedSugars: 12,
            protein: 12
          },
          stock: 95,
          sku: 'LR-WM-005',
          rating: 4.4,
          reviewCount: 22,
          sales: 110
        }
      })
    ]);

    console.log('🍭 Created sample products');

    // Create sample reviews
    const reviews = await Promise.all([
      prisma.review.create({
        data: {
          userId: customers[0].id,
          productId: products[0].id,
          rating: 5,
          title: 'Amazing flavor!',
          comment: 'These licorice ropes are absolutely amazing! The sour cherry flavor is perfectly balanced - not too tart, not too sweet. My kids love them and I do too!',
          isVerified: true
        }
      }),
      prisma.review.create({
        data: {
          userId: customers[1].id,
          productId: products[0].id,
          rating: 4,
          title: 'Great quality',
          comment: 'Great quality product. The sour cherry flavor tastes exactly like the real thing. Would definitely order again!',
          isVerified: true
        }
      }),
      prisma.review.create({
        data: {
          userId: customers[0].id,
          productId: products[1].id,
          rating: 5,
          title: 'Perfect blue raspberry!',
          comment: 'These are amazing! The blue raspberry ropes have that perfect tangy kick. Great for satisfying sweet cravings.',
          isVerified: true
        }
      }),
      prisma.review.create({
        data: {
          userId: customers[1].id,
          productId: products[2].id,
          rating: 4,
          title: 'Good apple flavor',
          comment: 'Good product overall. The green apple flavor is nice, though I wish it was a bit more sour. Still recommend!',
          isVerified: true
        }
      })
    ]);

    console.log('⭐ Created sample reviews');

    // Create sample contact messages
    await Promise.all([
      prisma.contactMessage.create({
        data: {
          name: 'Sarah Johnson',
          email: 'sarah.j@example.com',
          subject: 'Product Inquiry',
          message: 'Hi, I was wondering if you have any sugar-free options for your licorice ropes? I have dietary restrictions but love your products!',
          status: 'unread'
        }
      }),
      prisma.contactMessage.create({
        data: {
          name: 'Mike Wilson',
          email: 'mike.w@example.com',
          subject: 'Bulk Order',
          message: 'I would like to place a bulk order for my candy store. Could you please send me pricing information for orders over 100 units?',
          status: 'read'
        }
      })
    ]);

    console.log('📧 Created sample contact messages');

    // Create newsletter subscribers
    await Promise.all([
      prisma.newsletter.create({
        data: {
          email: 'newsletter1@example.com',
          isActive: true
        }
      }),
      prisma.newsletter.create({
        data: {
          email: 'newsletter2@example.com',
          isActive: true
        }
      })
    ]);

    console.log('📬 Created newsletter subscribers');

    console.log('✅ Database seeded successfully!');
    console.log('\n📊 Summary:');
    console.log(`👤 Admin user: ${adminUser.email}`);
    console.log(`   Password: ${process.env.ADMIN_PASSWORD || 'admin123'}`);
    console.log(`👥 Customers: ${customers.length}`);
    console.log(`   Email: john.doe@example.com / jane.smith@example.com`);
    console.log(`   Password: password123`);
    console.log(`🍭 Products: ${products.length}`);
    console.log(`⭐ Reviews: ${reviews.length}`);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

// Run seed if this file is executed directly
if (require.main === module) {
  seedData()
    .then(() => {
      console.log('🎉 Seed completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seed failed:', error);
      process.exit(1);
    });
}

export default seedData;
