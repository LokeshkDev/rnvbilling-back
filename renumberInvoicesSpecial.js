require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Business = require('./models/Business');
const Invoice = require('./models/Invoice');

const renumberInvoicesFrom53 = async () => {
    try {
        console.log('Connecting to Database...');
        await connectDB();
        console.log('Connected to Database successfully.');

        const business = await Business.findOne();
        if (!business) {
            console.error('No business profile found.');
            process.exit(1);
        }

        // 1. Renumber INVOICES starting from 53
        const invoices = await Invoice.find({
            business: business._id,
            type: 'INVOICE'
        }).sort({ createdAt: 1 });

        console.log(`Found ${invoices.length} existing invoices.`);
        const iPrefix = business.invoicePrefix || 'RNV-INV';
        const startingNumber = 53;

        for (let i = 0; i < invoices.length; i++) {
            const inv = invoices[i];
            const newNumValue = startingNumber + i;
            // Pad to 3 digits as per previous pattern
            const newInvoiceNumber = `${iPrefix}-${String(newNumValue).padStart(3, '0')}`;
            console.log(`INV: ${inv.invoiceNumber} -> ${newInvoiceNumber}`);
            await Invoice.findByIdAndUpdate(inv._id, { invoiceNumber: newInvoiceNumber });
        }

        // Update the counter to the last number used
        business.invoiceCounter = startingNumber + invoices.length - 1;
        await business.save();
        console.log(`Updated business invoiceCounter to ${business.invoiceCounter}`);

        console.log('Invoice renumbering complete.');
        process.exit(0);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

renumberInvoicesFrom53();
