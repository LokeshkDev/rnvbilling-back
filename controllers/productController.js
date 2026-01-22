const Product = require('../models/Product');

// @desc    Get all products
// @route   GET /api/products
// @access  Private
const getProducts = async (req, res) => {
    try {
        const products = await Product.find({ user: req.user._id }).sort({
            createdAt: -1,
        });

        const mappedProducts = products.map(p => ({
            ...p.toObject(),
            taxRate: p.gstRate // Map for frontend
        }));

        res.json(mappedProducts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Private
const getProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Check if product belongs to user
        if (product.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const mappedProduct = {
            ...product.toObject(),
            taxRate: product.gstRate // Map for frontend
        };

        res.json(mappedProduct);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private
const createProduct = async (req, res) => {
    try {
        console.log("Create Product Input:", req.body);

        // Sanitize and parse numbers
        const sanitizedBody = {
            ...req.body,
            price: Number(req.body.price),
            stock: Number(req.body.stock),
            lowStockThreshold: Number(req.body.lowStockThreshold || 10),
            gstRate: Number(req.body.taxRate || req.body.gstRate || 18),
            user: req.user._id,
        };

        const product = await Product.create(sanitizedBody);

        res.status(201).json(product);
    } catch (error) {
        console.error("Product Creation Error:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private
const updateProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Check if product belongs to user
        if (product.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const productData = {
            ...req.body,
            user: req.user._id,
        };

        // Parse numbers if they exist in body
        if (req.body.price !== undefined) productData.price = Number(req.body.price);
        if (req.body.stock !== undefined) productData.stock = Number(req.body.stock);
        if (req.body.lowStockThreshold !== undefined) productData.lowStockThreshold = Number(req.body.lowStockThreshold);
        if (req.body.taxRate !== undefined || req.body.gstRate !== undefined) {
            productData.gstRate = Number(req.body.taxRate || req.body.gstRate);
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            productData,
            { new: true, runValidators: true }
        );

        res.json(updatedProduct);
    } catch (error) {
        console.error("Product Update Error:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private
const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Check if product belongs to user
        if (product.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        await product.deleteOne();

        res.json({ message: 'Product removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get low stock products
// @route   GET /api/products/alerts/low-stock
// @access  Private
const getLowStockProducts = async (req, res) => {
    try {
        const products = await Product.find({ user: req.user._id });
        const lowStockProducts = products.filter(
            (product) => product.stock <= product.lowStockThreshold
        );
        res.json(lowStockProducts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    getLowStockProducts,
};
