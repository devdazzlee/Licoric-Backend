"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const wholesaleController_1 = require("../controllers/wholesaleController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.post('/inquiry', wholesaleController_1.submitWholesaleInquiry);
router.get('/inquiries', auth_1.adminAuth, wholesaleController_1.getWholesaleInquiries);
router.put('/inquiries/:id', auth_1.adminAuth, wholesaleController_1.updateWholesaleInquiryStatus);
exports.default = router;
//# sourceMappingURL=wholesale.js.map