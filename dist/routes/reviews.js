"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const reviewController_1 = require("../controllers/reviewController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
const reviewValidation = [
    (0, express_validator_1.body)('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    (0, express_validator_1.body)('comment').trim().isLength({ min: 10 }).withMessage('Comment must be at least 10 characters'),
    (0, express_validator_1.body)('productId').notEmpty().withMessage('Product ID is required')
];
router.get('/product/:productId', reviewController_1.getProductReviews);
router.get('/', reviewController_1.getReviews);
router.post('/', auth_1.optionalAuth, reviewValidation, reviewController_1.createReview);
router.put('/:id', auth_1.auth, reviewValidation, reviewController_1.updateReview);
router.delete('/:id', auth_1.auth, reviewController_1.deleteReview);
exports.default = router;
//# sourceMappingURL=reviews.js.map