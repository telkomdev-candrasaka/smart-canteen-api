const express = require('express');
const paymentsController = require('../controllers/payments.controller');
const { validateProcessPayment } = require('../validators/payments.validator');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/', verifyToken, validateProcessPayment, paymentsController.processPayment);

module.exports = router;
