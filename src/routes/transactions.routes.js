const express = require('express');
const transactionsController = require('../controllers/transactions.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = express.Router();

// Public route: transaction creation stays open to preserve the documented customer checkout flow.
router.post('/', transactionsController.createTransaction);
router.get('/:id', verifyToken, transactionsController.getTransactionById);

module.exports = router;
