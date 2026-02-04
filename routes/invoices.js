const express = require('express');
const router = express.Router();
const {
    getInvoices,
    getInvoice,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    getInvoiceStats,
    convertToInvoice
} = require('../controllers/invoiceController');
const { generateInvoicePDF } = require('../utils/pdfGenerator');
const { protect } = require('../middleware/auth');

router.route('/').get(protect, getInvoices).post(protect, createInvoice);

router.get('/stats/summary', protect, getInvoiceStats);

router
    .route('/:id')
    .get(protect, getInvoice)
    .put(protect, updateInvoice)
    .delete(protect, deleteInvoice);

router.get('/:id/pdf', protect, generateInvoicePDF);
router.post('/:id/convert', protect, convertToInvoice);

module.exports = router;
