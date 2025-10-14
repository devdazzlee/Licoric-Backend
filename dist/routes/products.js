"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const productController_1 = require("../controllers/productController");
const auth_1 = require("../middleware/auth");
const cloudinary_1 = require("../utils/cloudinary");
const router = express_1.default.Router();
router.get('/', productController_1.getProducts);
router.get('/search', productController_1.searchProducts);
router.get('/category/:category', productController_1.getProductsByCategory);
router.get('/:id', productController_1.getProduct);
router.post('/upload-image', cloudinary_1.upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({
                success: false,
                message: 'No image file provided'
            });
            return;
        }
        const imageUrl = await (0, cloudinary_1.uploadToCloudinary)(req.file);
        res.json({
            success: true,
            message: 'Image uploaded successfully',
            data: { imageUrl }
        });
    }
    catch (error) {
        console.error('Image upload error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to upload image'
        });
    }
});
router.post('/', auth_1.auth, auth_1.adminAuth, productController_1.createProduct);
router.put('/:id', auth_1.auth, auth_1.adminAuth, productController_1.updateProduct);
router.delete('/:id', auth_1.auth, auth_1.adminAuth, productController_1.deleteProduct);
exports.default = router;
//# sourceMappingURL=products.js.map