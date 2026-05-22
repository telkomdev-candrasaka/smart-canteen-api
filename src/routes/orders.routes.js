const express = require('express');
const ordersController = require('../controllers/orders.controller');
const { validateCreateOrder, validateOrderId } = require('../validators/orders.validator');

const router = express.Router();

router.post('/', validateCreateOrder, ordersController.createOrder);
router.get('/:id', validateOrderId, ordersController.getOrderById);

module.exports = router;
