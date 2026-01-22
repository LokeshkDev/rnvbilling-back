const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        invoice: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Invoice',
            required: true,
        },
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer',
            required: true,
        },
        amount: {
            type: Number,
            required: [true, 'Please provide payment amount'],
            min: 0,
        },
        paymentMode: {
            type: String,
            enum: ['CASH', 'UPI', 'BANK', 'CARD', 'CHEQUE', 'ACH'],
            required: true,
        },
        paymentDate: {
            type: Date,
            default: Date.now,
        },
        transactionId: {
            type: String,
            trim: true,
        },
        notes: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

// Index for faster searches
paymentSchema.index({ invoice: 1, paymentDate: -1 });

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
