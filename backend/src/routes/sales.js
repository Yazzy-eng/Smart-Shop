const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', salesController.listSales);
router.get('/:id', salesController.getSale);
router.post('/', salesController.createSale);
router.post('/:id/void', requireRole('admin', 'manager'), salesController.voidSale);

module.exports = router;
