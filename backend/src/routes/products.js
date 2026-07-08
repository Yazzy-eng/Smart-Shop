const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

// Any logged-in user (including cashiers) can look up products for a sale
router.get('/', productController.listProducts);
router.get('/:id', productController.getProduct);

// Only admin/manager can manage the catalog
router.post('/', requireRole('admin', 'manager'), productController.createProduct);
router.patch('/:id', requireRole('admin', 'manager'), productController.updateProduct);
router.delete('/:id', requireRole('admin', 'manager'), productController.deactivateProduct);

module.exports = router;
