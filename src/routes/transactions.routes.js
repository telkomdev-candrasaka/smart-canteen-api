const express = require('express');
const transactionsController = require('../controllers/transactions.controller');

const router = express.Router();

router.post('/', transactionsController.createTransaction);
router.get('/:id', transactionsController.getTransactionById);

module.exports = router;
