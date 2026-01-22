const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        name: {
            type: String,
            required: [true, 'Please provide product name'],
            trim: true,
        },
        description: {
            type: String,
        },
        hsnCode: {
            type: String,
            trim: true,
        },
        unit: {
            type: String,
            default: 'PCS',
            enum: ['PCS', 'KG', 'LITER', 'METER', 'BOX', 'DOZEN', 'SET'],
        },
        price: {
            type: Number,
            required: [true, 'Please provide price'],
            min: 0,
        },
        gstRate: {
            type: Number,
            required: [true, 'Please provide GST rate'],
            enum: [0, 5, 12, 18, 28],
            default: 18,
        },
        stock: {
            type: Number,
            default: 0,
            min: 0,
        },
        lowStockThreshold: {
            type: Number,
            default: 10,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

// Virtual for low stock alert
productSchema.virtual('isLowStock').get(function () {
    return this.stock <= this.lowStockThreshold;
});

// Index for faster searches
productSchema.index({ name: 1, hsnCode: 1 });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
