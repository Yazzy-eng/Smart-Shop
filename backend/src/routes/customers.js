const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', customerController.listCustomers);
router.get('/:id', customerController.getCustomer);
router.get('/:id/statement', customerController.getStatement);
router.post('/:id/payments', customerController.recordPayment);

// Only admin/manager can create/edit customer profiles or delete payments
router.post('/', requireRole('admin', 'manager'), customerController.createCustomer);
router.patch('/:id', requireRole('admin', 'manager'), customerController.updateCustomer);
router.delete('/payments/:paymentId', requireRole('admin', 'manager'), customerController.deletePayment);

module.exports = router;
