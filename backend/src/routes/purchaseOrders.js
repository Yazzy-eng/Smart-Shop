const express = require('express');
const router = express.Router();
const poController = require('../controllers/purchaseOrderController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth, requireRole('admin', 'manager'));

router.get('/', poController.listPurchaseOrders);
router.get('/:id', poController.getPurchaseOrder);
router.post('/', poController.createPurchaseOrder);
router.post('/:id/receive', poController.receivePurchaseOrder);
router.post('/:id/cancel', poController.cancelPurchaseOrder);

module.exports = router;
