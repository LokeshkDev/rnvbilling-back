const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        name: {
            type: String,
            required: [true, 'Please provide customer name'],
            trim: true,
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
        },
        phone: {
            type: String,
            required: [true, 'Please provide phone number'],
        },
        gstin: {
            type: String,
            trim: true,
            uppercase: true,
        },
        address: {
            street: String,
            city: String,
            state: String,
            pincode: String,
            country: {
                type: String,
                default: 'India',
            },
        },
        outstandingBalance: {
            type: Number,
            default: 0,
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
customerSchema.index({ name: 1, phone: 1 });

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;
