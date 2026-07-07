const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth, requireRole('admin'));

router.get('/', userController.listUsers);
router.post('/', userController.createUser);
router.patch('/:id/status', userController.updateUserStatus);
router.post('/:id/reset-password', userController.resetPassword);

module.exports = router;
