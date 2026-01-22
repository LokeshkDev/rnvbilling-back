const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');

// @desc    Get all payments
// @route   GET /api/payments
// @access  Private
const getPayments = async (req, res) => {
    try {
        const payments = await Payment.find({ user: req.user._id })
            .populate('invoice', 'invoiceNumber')
            .populate('customer', 'name')
            .sort({ createdAt: -1 });
        res.json(payments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get payments for an invoice
// @route   GET /api/payments/invoice/:invoiceId
// @access  Private
const getInvoicePayments = async (req, res) => {
    try {
        const payments = await Payment.find({
            user: req.user._id,
            invoice: req.params.invoiceId,
        }).sort({ createdAt: -1 });
        res.json(payments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create payment
// @route   POST /api/payments/:invoiceId
// @access  Private
const createPayment = async (req, res) => {
    try {
        const { amount, paymentMode, transactionId, notes, paymentDate } = req.body;
        const invoiceId = req.params.invoiceId;

        // Get invoice
        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        // Check if invoice belongs to user
        if (invoice.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        // Check if payment amount is valid
        if (amount <= 0) {
            return res.status(400).json({ message: 'Invalid payment amount' });
        }

        if (amount > invoice.balanceAmount) {
            return res.status(400).json({
                message: 'Payment amount cannot exceed balance amount',
            });
        }

        // Create payment
        const payment = await Payment.create({
            user: req.user._id,
            invoice: invoiceId,
            customer: invoice.customer,
            amount,
            paymentMode,
            transactionId,
            notes,
            paymentDate: paymentDate || Date.now(),
        });

        // Update invoice paid amount
        invoice.paidAmount += amount;
        await invoice.save(); // This will trigger pre-save hook to update status

        // Update customer outstanding balance
        const customer = await Customer.findById(invoice.customer);
        if (customer) {
            customer.outstandingBalance -= amount;
            await customer.save();
        }

        res.status(201).json(payment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete payment
// @route   DELETE /api/payments/:id
// @access  Private
const deletePayment = async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id);

        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' });
        }

        // Check if payment belongs to user
        if (payment.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        // Update invoice paid amount
        const invoice = await Invoice.findById(payment.invoice);
        if (invoice) {
            invoice.paidAmount -= payment.amount;
            await invoice.save();
        }

        // Update customer outstanding balance
        const customer = await Customer.findById(payment.customer);
        if (customer) {
            customer.outstandingBalance += payment.amount;
            await customer.save();
        }

        await payment.deleteOne();

        res.json({ message: 'Payment removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update payment
// @route   PUT /api/payments/:id
// @access  Private
const updatePayment = async (req, res) => {
    try {
        const { amount, paymentMode, transactionId, notes, paymentDate } = req.body;
        const payment = await Payment.findById(req.params.id);

        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' });
        }

        // Check if payment belongs to user
        if (payment.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const oldAmount = payment.amount;
        const diff = amount - oldAmount;

        // Update invoice paid amount
        const invoice = await Invoice.findById(payment.invoice);
        if (invoice) {
            if (diff > invoice.balanceAmount) {
                return res.status(400).json({
                    message: 'Payment amount cannot exceed balance amount',
                });
            }
            invoice.paidAmount += diff;
            await invoice.save();
        }

        // Update customer outstanding balance
        const customer = await Customer.findById(payment.customer);
        if (customer) {
            customer.outstandingBalance -= diff;
            await customer.save();
        }

        // Update payment
        payment.amount = amount;
        payment.paymentMode = paymentMode;
        payment.transactionId = transactionId;
        payment.notes = notes;
        if (paymentDate) {
            payment.paymentDate = paymentDate;
        }

        const updatedPayment = await payment.save();

        res.json(updatedPayment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getPayments,
    getInvoicePayments,
    createPayment,
    deletePayment,
    updatePayment,
};
