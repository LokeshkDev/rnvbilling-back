const express = require('express');
const router = express.Router();
const {
    getPayments,
    getInvoicePayments,
    createPayment,
    deletePayment,
    updatePayment,
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

router.get('/', protect, getPayments);

router.get('/invoice/:invoiceId', protect, getInvoicePayments);

router.post('/:invoiceId', protect, createPayment);

router.put('/:id', protect, updatePayment);

router.delete('/:id', protect, deletePayment);

module.exports = router;
