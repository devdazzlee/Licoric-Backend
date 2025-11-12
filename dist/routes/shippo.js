"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const shippoController_1 = require("../controllers/shippoController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.post('/webhook', shippoController_1.shippoWebhook);
router.post('/calculate-rates', shippoController_1.calculateCheckoutRates);
router.post('/validate-address', auth_1.auth, shippoController_1.validateShippingAddress);
router.post('/rates', auth_1.auth, shippoController_1.getShippingRatesController);
router.post('/create-shipment', auth_1.auth, shippoController_1.createShipmentController);
exports.default = router;
//# sourceMappingURL=shippo.js.map