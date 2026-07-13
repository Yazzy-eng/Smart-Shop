const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

// Dashboard is visible to everyone logged in (cashiers see a lighter version client-side)
router.get('/dashboard', reportsController.getDashboard);

// Detailed reports are admin/manager only
router.use(requireRole('admin', 'manager'));
router.get('/sales', reportsController.getSalesReport);
router.get('/profit-loss', reportsController.getProfitLoss);
router.get('/best-sellers', reportsController.getBestSellers);
router.get('/cashier-performance', reportsController.getCashierPerformance);
router.get('/customer-balances', reportsController.getCustomerBalances);
router.get('/inventory', reportsController.getInventoryReport);
router.get('/walkins', reportsController.getWalkinSales);

module.exports = router;
