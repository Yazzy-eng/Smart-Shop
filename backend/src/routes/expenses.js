const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth, requireRole('admin', 'manager'));

router.get('/', expenseController.listExpenses);
router.post('/', expenseController.createExpense);

module.exports = router;
