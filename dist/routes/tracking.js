"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const trackingController_1 = require("../controllers/trackingController");
const router = (0, express_1.Router)();
router.post("/events", trackingController_1.trackEvents);
router.post("/click", trackingController_1.trackClick);
router.post("/order", trackingController_1.trackOrder);
router.get("/stats", trackingController_1.getStats);
router.get("/dashboard", trackingController_1.getDashboardStats);
router.post("/referral-codes", trackingController_1.createReferralCode);
router.get("/referral-codes", trackingController_1.getReferralCodes);
router.put("/referral-codes/:code", trackingController_1.updateReferralCode);
exports.default = router;
//# sourceMappingURL=tracking.js.map