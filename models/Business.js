const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        businessName: {
            type: String,
            required: [true, 'Please provide business name'],
            trim: true,
        },
        gstin: {
            type: String,
            trim: true,
            uppercase: true,
            default: '',
        },
        pan: {
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
        contact: {
            phone: String,
            email: String,
            website: String,
        },
        logo: {
            type: String,
            default: '',
        },
        bankDetails: {
            accountName: String,
            accountNumber: String,
            ifscCode: String,
            bankName: String,
            branch: String,
        },
        invoicePrefix: {
            type: String,
            default: 'INV',
        },
        invoiceCounter: {
            type: Number,
            default: 0,
        },
        termsAndConditions: {
            type: String,
            default: '',
        },
        theme: {
            primaryColor: { type: String, default: '#2C3E50' },
            secondaryColor: { type: String, default: '#34495E' },
            accentColor: { type: String, default: '#3498DB' },
            businessNameColor: { type: String, default: '#2C3E50' },
            font: { type: String, default: 'Helvetica' },
            titleFontSize: { type: Number, default: 24 },
            bodyFontSize: { type: Number, default: 10 },
        },
    },
    {
        timestamps: true,
    }
);

const Business = mongoose.model('Business', businessSchema);

module.exports = Business;
