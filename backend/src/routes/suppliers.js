const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', supplierController.listSuppliers);
router.post('/', requireRole('admin', 'manager'), supplierController.createSupplier);
router.patch('/:id', requireRole('admin', 'manager'), supplierController.updateSupplier);

module.exports = router;
