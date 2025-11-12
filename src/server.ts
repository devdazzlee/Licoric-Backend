import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from "./routes/auth";
import productRoutes from "./routes/products";
import userRoutes from "./routes/users";
import cartRoutes from "./routes/cart";
import favoriteRoutes from "./routes/favorites";
import orderRoutes from "./routes/orders";
import reviewRoutes from "./routes/reviews";
import contactRoutes from "./routes/contact";
import adminRoutes from "./routes/admin";
import paymentRoutes from "./routes/payment";
import shipmentRoutes from "./routes/shipment";
import shippoRoutes from "./routes/shippo";
import notificationRoutes from "./routes/notification";
import categoryRoutes from "./routes/categories";
import discountRoutes from "./routes/discounts";
import newsletterRoutes from "./routes/newsletter";
import addressRoutes from "./routes/addresses";
import inventoryRoutes from "./routes/inventory";
import flavorRoutes from "./routes/flavors";
import returnRoutes from "./routes/returns";
import wholesaleRoutes from "./routes/wholesale";
import trackingRoutes from "./routes/tracking";

// Import middleware
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import { setupSocketHandlers } from "./services/socketService";

const app = express();
const server = createServer(app);

// Trust proxy - Required for Vercel deployment and rate limiting
app.set("trust proxy", 1);
// Socket.IO CORS configuration
const socketAllowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3002",
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL,
  "https://licorice-ropes.vercel.app",
  "https://southernsweetandsour.com",
  "https://www.southernsweetandsour.com", // Include www version
  "https://southernsweet-okob.vercel.app",
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: socketAllowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
  },
});

const PORT = process.env.PORT || 5000;

// Environment validation
const requiredEnvVars = [
  "DATABASE_URL",
  "JWT_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  })
);

// CORS configuration - allow multiple origins
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3002",
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL,
  "https://licorice-ropes.vercel.app",
  "https://southernsweetandsour.com",
  "https://www.southernsweetandsour.com", // Include www version
  "https://southernsweet-okob.vercel.app",
].filter(Boolean); // Remove undefined values

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`❌ CORS blocked origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
    exposedHeaders: ["Set-Cookie"],
  })
);

app.use(limiter);
app.use(morgan("combined"));

// Body parsing middleware - MUST be before cookieParser
// Use raw body only for webhook routes; json for others
app.use((req, res, next) => {
  if (
    req.originalUrl === "/api/payment/webhook" ||
    req.originalUrl === "/payments/webhook" ||
    req.originalUrl === "/api/shippo/webhook" ||
    req.originalUrl === "/shippo/webhook"
  ) {
    express.raw({ type: "application/json" })(req, res, next);
  } else {
    express.json({ limit: "500mb" })(req, res, next);
  }
});

app.use(express.urlencoded({ extended: true, limit: "500mb" }));
app.use(cookieParser()); // Add cookie parser AFTER body parsing

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: "2.0.0",
    features: {
      typescript: true,
      cookies: true,
      refreshTokens: true,
      socketIO: true,
      payments: true,
      shipments: true,
      notifications: true,
    },
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/users", userRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/shipment", shipmentRoutes);
app.use("/api/shippo", shippoRoutes);

// Webhook routes without /api prefix (for Stripe/Shippo webhooks)
app.use("/payments", paymentRoutes); // Stripe webhook at /payments/webhook
app.use("/shippo", shippoRoutes); // Shippo webhook at /shippo/webhook
app.use("/api/notifications", notificationRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/discounts", discountRoutes);
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/flavors", flavorRoutes);
app.use("/api/returns", returnRoutes);
app.use("/api/wholesale", wholesaleRoutes);
app.use("/api/tracking", trackingRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Licorice Ropes API v2.0 - TypeScript Edition",
    version: "2.0.0",
    features: [
      "Full TypeScript Support",
      "ES6 Imports",
      "HTTP Cookies for Auth",
      "Access & Refresh Tokens",
      "Payment Integration (Stripe/PayPal)",
      "Shipment Tracking",
      "Real-time Notifications (Socket.IO)",
      "Advanced Admin Dashboard",
      "Inventory Management",
      "Analytics & Reporting",
    ],
    authentication: {
      type: "JWT with HTTP Cookies",
      accessToken: "15 minutes",
      refreshToken: "7 days",
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      },
    },
    documentation: "/api/docs",
    health: "/health",
  });
});

// Setup Socket.IO handlers
setupSocketHandlers(io);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Start server
server.listen(PORT, () => {
  console.log("🚀 ====================================");
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
  console.log("🚀 ====================================");
  console.log("✅ TypeScript: Enabled");
  console.log("✅ ES6 Imports: Enabled");
  console.log("✅ HTTP Cookies: Enabled");
  console.log("✅ Access & Refresh Tokens: Enabled");
  console.log("✅ Socket.IO: Enabled");
  console.log("✅ Payment Integration: Ready");
  console.log("✅ Shipment Tracking: Active");
  console.log("✅ Advanced Analytics: Available");
  console.log("🚀 ====================================");
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    console.log("Process terminated");
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received. Shutting down gracefully...");
  server.close(() => {
    console.log("Process terminated");
  });
});

export default app;
