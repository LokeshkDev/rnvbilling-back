const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: false,
    },
    productName: String,
    hsnCode: String,
    quantity: {
        type: Number,
        required: true,
        min: 1,
    },
    unit: String,
    tool: String, // Keeping for simple entries
    processes: [
        {
            name: String,
            price: Number
        }
    ],
    price: {
        type: Number,
        required: true,
    },
    gstRate: {
        type: Number,
        required: true,
    },
    amount: Number, // quantity * price
    gstAmount: Number, // amount * gstRate / 100
    totalAmount: Number, // amount + gstAmount
});

const invoiceSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        business: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Business',
            required: true,
        },
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer',
            required: true,
        },
        invoiceNumber: {
            type: String,
            required: true,
            unique: true,
        },
        invoiceDate: {
            type: Date,
            default: Date.now,
        },
        dueDate: {
            type: Date,
        },
        items: [invoiceItemSchema],
        subtotal: {
            type: Number,
            required: true,
        },
        cgst: {
            type: Number,
            default: 0,
        },
        sgst: {
            type: Number,
            default: 0,
        },
        igst: {
            type: Number,
            default: 0,
        },
        totalGst: {
            type: Number,
            required: true,
        },
        total: {
            type: Number,
            required: true,
        },
        paidAmount: {
            type: Number,
            default: 0,
        },
        balanceAmount: {
            type: Number,
            default: 0,
        },
        status: {
            type: String,
            enum: ['PAID', 'UNPAID', 'PARTIAL'],
            default: 'UNPAID',
        },
        type: {
            type: String,
            enum: ['INVOICE', 'QUOTATION'],
            default: 'INVOICE',
        },
        notes: {
            type: String,
        },
        termsAndConditions: {
            type: String,
        },
        // E-way Bill Details
        ewayBillNo: {
            type: String,
        },
        transportMode: {
            type: String,
            enum: ['', 'Road', 'Rail', 'Air', 'Ship'],
            default: '',
        },
        vehicleNo: {
            type: String,
        },
        transporterName: {
            type: String,
        },
        transporterId: {
            type: String,
        },
        distance: {
            type: Number,
        },
    },
    {
        timestamps: true,
    }
);

// Pre-save hook to calculate totals
invoiceSchema.pre('save', function () {
    // Calculate item totals
    this.items.forEach((item) => {
        item.amount = (item.quantity || 0) * (item.price || 0);
        item.gstAmount = (item.amount * (item.gstRate || 0)) / 100;
        item.totalAmount = item.amount + item.gstAmount;
    });

    // Calculate invoice totals
    this.subtotal = this.items.reduce((sum, item) => sum + (item.amount || 0), 0);
    this.totalGst = this.items.reduce((sum, item) => sum + (item.gstAmount || 0), 0);
    this.total = this.subtotal + this.totalGst;
    this.balanceAmount = this.total - (this.paidAmount || 0);

    // Update status based on payment
    if (this.paidAmount === 0 || !this.paidAmount) {
        this.status = 'UNPAID';
    } else if (this.paidAmount >= this.total) {
        this.status = 'PAID';
    } else {
        this.status = 'PARTIAL';
    }
});

// Index for faster searches
invoiceSchema.index({ invoiceNumber: 1, customer: 1, invoiceDate: -1 });

const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice;
