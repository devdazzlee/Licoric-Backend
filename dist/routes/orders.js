"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const orderController_1 = require("../controllers/orderController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.get('/my-orders', auth_1.auth, orderController_1.getUserOrders);
router.get('/:id', auth_1.optionalAuth, orderController_1.getOrder);
router.post('/', auth_1.optionalAuth, orderController_1.createOrder);
router.get('/', auth_1.auth, auth_1.adminAuth, orderController_1.getOrders);
router.put('/:id/status', auth_1.auth, auth_1.adminAuth, orderController_1.updateOrderStatus);
exports.default = router;
//# sourceMappingURL=orders.js.map