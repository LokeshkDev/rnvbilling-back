require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Business = require('./models/Business');
const Invoice = require('./models/Invoice');

const renumberEverything = async () => {
    try {
        console.log('Connecting to Database...');
        await connectDB();
        console.log('Connected to Database successfully.');

        const business = await Business.findOne();
        if (!business) {
            console.error('No business profile found.');
            process.exit(1);
        }

        // 1. Renumber QUOTATIONS
        const quotations = await Invoice.find({
            business: business._id,
            type: 'QUOTATION'
        }).sort({ createdAt: 1 });

        console.log(`Found ${quotations.length} existing quotations.`);
        const qPrefix = business.quotationPrefix || 'RNV-QTN';

        for (let i = 0; i < quotations.length; i++) {
            const quote = quotations[i];
            const newNumValue = i + 1;
            const newQuotationNumber = `${qPrefix}-${String(newNumValue).padStart(3, '0')}`;
            console.log(`QTN: ${quote.invoiceNumber} -> ${newQuotationNumber}`);
            await Invoice.findByIdAndUpdate(quote._id, { invoiceNumber: newQuotationNumber });
        }
        business.quotationCounter = quotations.length;

        // 2. Renumber INVOICES
        const invoices = await Invoice.find({
            business: business._id,
            type: 'INVOICE'
        }).sort({ createdAt: 1 });

        console.log(`Found ${invoices.length} existing invoices.`);
        const iPrefix = business.invoicePrefix || 'RNV-INV';

        for (let i = 0; i < invoices.length; i++) {
            const inv = invoices[i];
            const newNumValue = i + 1;
            // Changing to 3 digits for consistency if requested
            const newInvoiceNumber = `${iPrefix}-${String(newNumValue).padStart(3, '0')}`;
            console.log(`INV: ${inv.invoiceNumber} -> ${newInvoiceNumber}`);
            await Invoice.findByIdAndUpdate(inv._id, { invoiceNumber: newInvoiceNumber });
        }
        business.invoiceCounter = invoices.length;

        await business.save();
        console.log(`Updated business counters: QTN=${business.quotationCounter}, INV=${business.invoiceCounter}`);

        console.log('All renumbering complete.');
        process.exit(0);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

renumberEverything();
