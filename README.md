# Licorice Ropes Backend API

A complete Node.js backend API for the Licorice Ropes e-commerce website built with Express.js, Prisma ORM, and PostgreSQL.

## 🚀 Features

- **User Authentication & Authorization** - JWT-based auth with role-based access control
- **Product Management** - Full CRUD operations for products with image uploads
- **Shopping Cart** - Add, remove, update cart items with real-time calculations
- **Favorites System** - Save and manage favorite products
- **Order Management** - Complete order processing with status tracking
- **Review System** - Product reviews with ratings and moderation
- **Admin Dashboard** - Comprehensive admin panel with analytics
- **Image Upload** - Cloudinary integration for product images
- **Email Integration** - Contact form and newsletter management
- **Database** - PostgreSQL with Prisma ORM

## 🛠️ Tech Stack

- **Runtime**: Node.js (ES6+)
- **Framework**: Express.js
- **Database**: PostgreSQL (Neon)
- **ORM**: Prisma
- **Authentication**: JWT
- **File Upload**: Cloudinary
- **Validation**: Express-validator
- **Security**: Helmet, CORS, Rate limiting

## 📋 Prerequisites

- Node.js (v16 or higher)
- Yarn package manager
- PostgreSQL database
- Cloudinary account

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   yarn install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   # Database
   DATABASE_URL="your-postgresql-connection-string"
   
   # JWT
   JWT_SECRET="your-jwt-secret"
   JWT_EXPIRES_IN="7d"
   
   # Cloudinary
   CLOUDINARY_CLOUD_NAME="your-cloud-name"
   CLOUDINARY_API_KEY="your-api-key"
   CLOUDINARY_API_SECRET="your-api-secret"
   
   # Server
   PORT=5000
   NODE_ENV="development"
   FRONTEND_URL="http://localhost:3000"
   ```

4. **Database Setup**
   ```bash
   # Generate Prisma client
   yarn db:generate
   
   # Push schema to database
   yarn db:push
   
   # Seed the database with sample data
   yarn db:seed
   ```

5. **Start the server**
   ```bash
   # Development mode
   yarn dev
   
   # Production mode
   yarn start
   ```

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Products
- `GET /api/products` - Get all products (with pagination, filtering, sorting)
- `GET /api/products/:id` - Get single product
- `GET /api/products/search` - Search products
- `GET /api/products/category/:category` - Get products by category
- `POST /api/products` - Create product (Admin)
- `PUT /api/products/:id` - Update product (Admin)
- `DELETE /api/products/:id` - Delete product (Admin)

### Cart
- `GET /api/cart` - Get user's cart
- `POST /api/cart/add` - Add item to cart
- `PUT /api/cart/update/:productId` - Update cart item quantity
- `DELETE /api/cart/remove/:productId` - Remove item from cart
- `DELETE /api/cart/clear` - Clear entire cart

### Favorites
- `GET /api/favorites` - Get user's favorites
- `POST /api/favorites/add` - Add product to favorites
- `DELETE /api/favorites/remove/:productId` - Remove product from favorites

### Orders
- `POST /api/orders` - Create new order
- `GET /api/orders/my-orders` - Get user's orders
- `GET /api/orders/:id` - Get single order
- `GET /api/orders` - Get all orders (Admin)
- `PUT /api/orders/:id/status` - Update order status (Admin)

### Reviews
- `GET /api/reviews/product/:productId` - Get product reviews
- `GET /api/reviews` - Get all reviews (Admin)
- `POST /api/reviews` - Create review
- `PUT /api/reviews/:id` - Update review
- `DELETE /api/reviews/:id` - Delete review

### Contact & Newsletter
- `POST /api/contact` - Send contact message
- `GET /api/contact` - Get contact messages (Admin)
- `PUT /api/contact/:id` - Update message status (Admin)

### Admin Dashboard
- `GET /api/admin/dashboard` - Get dashboard statistics
- `GET /api/admin/users` - Get all users
- `GET /api/admin/orders` - Get all orders
- `GET /api/admin/products` - Get all products
- `GET /api/admin/reviews` - Get all reviews

## 🗄️ Database Schema

### Key Models:
- **User** - Customer and admin users with authentication
- **Product** - Product catalog with images, pricing, and inventory
- **Order** - Order management with status tracking
- **OrderItem** - Individual items within orders
- **CartItem** - Shopping cart functionality
- **Favorite** - User favorites system
- **Review** - Product reviews and ratings
- **ContactMessage** - Contact form submissions
- **Newsletter** - Newsletter subscriptions

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### User Roles:
- **CUSTOMER** - Can browse, purchase, and review products
- **ADMIN** - Full access to all endpoints and admin dashboard

## 📊 Admin Dashboard Features

- **Dashboard Statistics** - Total users, orders, products, revenue
- **Order Management** - View, update order status, track shipments
- **Product Management** - Add, edit, delete products with image uploads
- **User Management** - View customer details and order history
- **Review Management** - Moderate product reviews
- **Analytics** - Monthly revenue, top products, order status distribution

## 🚀 Deployment

### Environment Variables for Production:
```env
NODE_ENV=production
DATABASE_URL=your-production-database-url
JWT_SECRET=your-secure-jwt-secret
CLOUDINARY_CLOUD_NAME=your-cloudinary-name
CLOUDINARY_API_KEY=your-cloudinary-key
CLOUDINARY_API_SECRET=your-cloudinary-secret
FRONTEND_URL=https://your-frontend-domain.com
```

### Deployment Steps:
1. Set up production database
2. Configure environment variables
3. Run database migrations: `yarn db:push`
4. Seed initial data: `yarn db:seed`
5. Deploy to your hosting platform

## 🧪 Testing

Test the API endpoints using tools like:
- Postman
- Insomnia
- curl commands

### Sample API Calls:

**Register User:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

## 📝 Scripts

- `yarn dev` - Start development server with nodemon
- `yarn start` - Start production server
- `yarn db:generate` - Generate Prisma client
- `yarn db:push` - Push schema changes to database
- `yarn db:migrate` - Create and run migrations
- `yarn db:seed` - Seed database with sample data
- `yarn db:studio` - Open Prisma Studio

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions, please contact:
- Email: support@licoriceropes.com
- Phone: +1 (555) 123-4567

---

**Built with ❤️ for Licorice Ropes E-commerce**







