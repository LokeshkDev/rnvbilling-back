const Invoice = require('../models/Invoice');
const Business = require('../models/Business');
const Customer = require('../models/Customer');
const Product = require('../models/Product');

// @desc    Get all invoices
// @route   GET /api/invoices
// @access  Private
const getInvoices = async (req, res) => {
    try {
        const query = { user: req.user._id };
        if (req.query.type) {
            if (req.query.type === 'INVOICE') {
                // Return explicitly INVOICE OR documents without any type field (legacy)
                query.$or = [
                    { type: 'INVOICE' },
                    { type: { $exists: false } }
                ];
            } else {
                query.type = req.query.type;
            }
        }

        const invoices = await Invoice.find(query)
            .populate('customer', 'name phone')
            .populate('business', 'businessName')
            .sort({ createdAt: -1 });
        res.json(invoices);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single invoice
// @route   GET /api/invoices/:id
// @access  Private
const getInvoice = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id)
            .populate('customer')
            .populate('business')
            .populate('items.product');

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        // Check if invoice belongs to user
        if (invoice.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        res.json(invoice);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new invoice
// @route   POST /api/invoices
// @access  Private
// @desc    Create new invoice
// @route   POST /api/invoices
// @access  Private
const createInvoice = async (req, res) => {
    try {
        const { customer, customerId, items, type, notes, date, dueDate } = req.body;

        // Handle input variations (frontend might send 'customer' or 'customerId')
        const finalCustomerId = customerId || customer;
        const invoiceDate = date || Date.now();

        // Get business associated with user
        const business = await Business.findOne({ user: req.user._id });
        if (!business) {
            return res.status(404).json({ message: 'Business profile not found. Please complete business profile first.' });
        }

        // Generate invoice number
        business.invoiceCounter += 1;
        const invoiceNumber = `${business.invoicePrefix}-${String(
            business.invoiceCounter
        ).padStart(4, '0')}`;
        await business.save();

        // Get customer
        const customerDoc = await Customer.findById(finalCustomerId);
        if (!customerDoc) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        // Process items
        const processedItems = await Promise.all(
            items.map(async (item) => {
                let productData = {
                    name: item.productName || item.name,
                    hsnCode: item.hsnCode || item.partNo || '',
                    unit: item.unit || 'PCS',
                    gstRate: item.gstRate || 18
                };

                if (item.product) {
                    const product = await Product.findById(item.product);
                    if (product) {
                        productData.name = product.name;
                        productData.hsnCode = product.hsnCode;
                        productData.unit = product.unit;
                        productData.gstRate = product.gstRate;

                        // Deduct stock if it's a final invoice
                        const isInvoice = !type || type === 'INVOICE';
                        if (isInvoice) {
                            product.stock -= item.quantity;
                            await product.save();
                        }
                    }
                }

                // Override if specific values provided in item
                const finalName = item.productName || item.description || productData.name;
                const finalHsn = item.hsnCode || item.partNo || productData.hsnCode;
                const appliedGstRate = (item.gstRate !== undefined && item.gstRate !== null)
                    ? item.gstRate
                    : (item.taxRate !== undefined && item.taxRate !== null ? item.taxRate : productData.gstRate);

                // Calculate price from processes if available
                const itemProcesses = item.processes || [];
                let calculatedPrice = Number(item.price) || 0;

                if (itemProcesses.length > 0) {
                    calculatedPrice = itemProcesses.reduce((sum, p) => sum + (Number(p.price) || 0), 0);
                }

                return {
                    product: item.product || null,
                    productName: finalName,
                    hsnCode: finalHsn,
                    quantity: Number(item.quantity) || 1,
                    unit: item.unit || productData.unit,
                    price: calculatedPrice,
                    gstRate: Number(appliedGstRate),
                    processes: itemProcesses,
                    tool: item.tool || item.toolDetails
                };
            })
        );

        // Determine GST split
        const businessState = business.address?.state?.toLowerCase();
        const customerState = customerDoc.address?.state?.toLowerCase();

        // Simple string comparison for state
        const isInterState = businessState && customerState && (businessState !== customerState);

        // Create invoice
        const invoice = new Invoice({
            user: req.user._id,
            business: business._id,
            customer: finalCustomerId,
            invoiceNumber,
            invoiceDate,
            dueDate,
            items: processedItems,
            type: type || 'INVOICE',
            notes,
            termsAndConditions: business.termsAndConditions, // Copy default terms
        });

        // Totals are calculated in pre-save hook

        // Pre-save calc requires we assume IGST vs CGST/SGST split logic might need to be passed or handled 
        // The model hook calculates TOTALS. 
        // But the split (IGST vs CGST+SGST) logic is currently in controller?
        // Wait, the model hook calculates `gstAmount` per item.
        // It sums up `totalGst`.
        // BUT the model hooks doesn't know about `isInterState`.
        // We should set the split logic here on the instance.

        // Let's run calculation manually or let hook do totals, then we split tax.
        // Actually, we can calc tax here to be safe and set it.

        let totalGst = 0;
        let subtotal = 0;

        processedItems.forEach(item => {
            const amount = item.quantity * item.price;
            const gst = (amount * item.gstRate) / 100;
            item.amount = amount;
            item.gstAmount = gst;
            item.totalAmount = amount + gst;

            subtotal += amount;
            totalGst += gst;
        });

        invoice.subtotal = subtotal;
        invoice.totalGst = totalGst;
        invoice.total = subtotal + totalGst;
        invoice.balanceAmount = invoice.total;

        if (isInterState) {
            invoice.igst = totalGst;
            invoice.cgst = 0;
            invoice.sgst = 0;
        } else {
            invoice.igst = 0;
            invoice.cgst = totalGst / 2;
            invoice.sgst = totalGst / 2;
        }

        await invoice.save();
        console.log(`Created document: ${invoice.invoiceNumber} type: ${invoice.type}`);

        // Update customer balance only if it's an invoice
        if (invoice.type === 'INVOICE') {
            customerDoc.outstandingBalance += invoice.balanceAmount;
            await customerDoc.save();
        }

        res.status(201).json(invoice);
    } catch (error) {
        console.error("Create Invoice Error:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update invoice
// @route   PUT /api/invoices/:id
// @access  Private
const updateInvoice = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id);

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        // Check if invoice belongs to user
        if (invoice.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        // 1. Revert previous stock and customer balance
        if (invoice.type === 'INVOICE') {
            for (const item of invoice.items) {
                const product = await Product.findById(item.product);
                if (product) {
                    product.stock += item.quantity;
                    await product.save();
                }
            }

            const oldCustomer = await Customer.findById(invoice.customer);
            if (oldCustomer) {
                oldCustomer.outstandingBalance -= invoice.balanceAmount;
                await oldCustomer.save();
            }
        }

        // 2. Prepare new data
        const { customer, customerId, items, type, notes, date, dueDate } = req.body;
        const finalCustomerId = customerId || customer || invoice.customer;

        // Get business to check logic
        const business = await Business.findOne({ user: req.user._id });

        // Process new items
        const processedItems = await Promise.all(
            items.map(async (item) => {
                let productData = {
                    name: item.productName || item.name,
                    hsnCode: item.hsnCode || item.partNo || '',
                    unit: item.unit || 'PCS',
                    gstRate: item.gstRate || 18
                };

                if (item.product) {
                    const product = await Product.findById(item.product);
                    if (product) {
                        productData.name = product.name;
                        productData.hsnCode = product.hsnCode;
                        productData.unit = product.unit;
                        productData.gstRate = product.gstRate;

                        // Deduct stock for new items
                        const isInvoice = !type || type === 'INVOICE';
                        if (isInvoice) {
                            product.stock -= item.quantity;
                            await product.save();
                        }
                    }
                }

                const finalName = item.productName || item.description || productData.name;
                const finalHsn = item.hsnCode || item.partNo || productData.hsnCode;
                const appliedGstRate = (item.gstRate !== undefined && item.gstRate !== null)
                    ? item.gstRate
                    : (item.taxRate !== undefined && item.taxRate !== null ? item.taxRate : productData.gstRate);

                // Calculate price from processes if available
                const itemProcesses = item.processes || [];
                let calculatedPrice = Number(item.price) || 0;

                if (itemProcesses.length > 0) {
                    calculatedPrice = itemProcesses.reduce((sum, p) => sum + (Number(p.price) || 0), 0);
                }

                return {
                    product: item.product || null,
                    productName: finalName,
                    hsnCode: finalHsn,
                    quantity: Number(item.quantity) || 1,
                    unit: item.unit || productData.unit,
                    price: calculatedPrice,
                    gstRate: Number(appliedGstRate),
                    processes: itemProcesses,
                    tool: item.tool || item.toolDetails
                };
            })
        );

        // Determine GST split for new customer/state
        const newCustomerDoc = await Customer.findById(finalCustomerId);
        const businessState = business.address?.state?.toLowerCase();
        const customerState = newCustomerDoc?.address?.state?.toLowerCase();
        const isInterState = businessState && customerState && (businessState !== customerState);

        // Update invoice fields
        invoice.customer = finalCustomerId;
        invoice.items = processedItems;
        invoice.type = type || invoice.type;
        invoice.notes = notes !== undefined ? notes : invoice.notes;
        invoice.invoiceDate = date || invoice.invoiceDate;
        invoice.dueDate = dueDate || invoice.dueDate;

        // Recalculate Totals
        let totalGst = 0;
        let subtotal = 0;
        processedItems.forEach(item => {
            const amount = item.quantity * item.price;
            const gst = (amount * item.gstRate) / 100;
            item.amount = amount;
            item.gstAmount = gst;
            item.totalAmount = amount + gst;
            subtotal += amount;
            totalGst += gst;
        });

        invoice.subtotal = subtotal;
        invoice.totalGst = totalGst;
        invoice.total = subtotal + totalGst;
        // Balance = Total - Paid. We keep old paidAmount for now.
        invoice.balanceAmount = invoice.total - invoice.paidAmount;

        if (isInterState) {
            invoice.igst = totalGst;
            invoice.cgst = 0;
            invoice.sgst = 0;
        } else {
            invoice.igst = 0;
            invoice.cgst = totalGst / 2;
            invoice.sgst = totalGst / 2;
        }

        await invoice.save();
        console.log(`Updated document: ${invoice.invoiceNumber} type: ${invoice.type}`);

        // 3. Update new customer balance only if it's an invoice
        if (invoice.type === 'INVOICE' && newCustomerDoc) {
            newCustomerDoc.outstandingBalance += invoice.balanceAmount;
            await newCustomerDoc.save();
        }

        res.json(invoice);
    } catch (error) {
        console.error("Update Invoice Error:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete invoice
// @route   DELETE /api/invoices/:id
// @access  Private
const deleteInvoice = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id);

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        // Check if invoice belongs to user
        if (invoice.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        // Restore stock for invoice items
        if (invoice.type === 'INVOICE') {
            for (const item of invoice.items) {
                const product = await Product.findById(item.product);
                if (product) {
                    product.stock += item.quantity;
                    await product.save();
                }
            }
        }

        // Update customer outstanding balance
        const customer = await Customer.findById(invoice.customer);
        if (customer) {
            customer.outstandingBalance -= invoice.balanceAmount;
            await customer.save();
        }

        await invoice.deleteOne();

        res.json({ message: 'Invoice removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get invoice statistics
// @route   GET /api/invoices/stats/summary
// @access  Private
const getInvoiceStats = async (req, res) => {
    try {
        const invoices = await Invoice.find({ user: req.user._id });

        const stats = {
            totalInvoices: invoices.length,
            totalSales: invoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
            totalPaid: invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0),
            totalOutstanding: invoices.reduce((sum, inv) => sum + (inv.balanceAmount || 0), 0),
            totalGst: invoices.reduce((sum, inv) => sum + (inv.totalGst || 0), 0),
            totalCgst: invoices.reduce((sum, inv) => sum + (inv.cgst || 0), 0),
            totalSgst: invoices.reduce((sum, inv) => sum + (inv.sgst || 0), 0),
            totalIgst: invoices.reduce((sum, inv) => sum + (inv.igst || 0), 0),
            paidInvoices: invoices.filter((inv) => inv.status === 'PAID').length,
            unpaidInvoices: invoices.filter((inv) => inv.status === 'UNPAID').length,
            partialInvoices: invoices.filter((inv) => inv.status === 'PARTIAL').length,
        };

        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getInvoices,
    getInvoice,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    getInvoiceStats,
};
