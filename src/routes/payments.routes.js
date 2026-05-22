const express = require('express');
const paymentsController = require('../controllers/payments.controller');
const { validateProcessPayment } = require('../validators/payments.validator');

const router = express.Router();

router.post('/', validateProcessPayment, paymentsController.processPayment);

module.exports = router;
