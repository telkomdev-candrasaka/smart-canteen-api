const express = require('express');
const ordersController = require('../controllers/orders.controller');
const { validateCreateOrder, validateOrderId, validateUpdateOrderStatus } = require('../validators/orders.validator');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = express.Router();

// Public route: order creation stays open to preserve the documented customer checkout flow.
router.post('/', validateCreateOrder, ordersController.createOrder);
router.get('/:id', verifyToken, validateOrderId, ordersController.getOrderById);
router.patch('/:id/status', verifyToken, validateOrderId, validateUpdateOrderStatus, ordersController.updateOrderStatus);

module.exports = router;
