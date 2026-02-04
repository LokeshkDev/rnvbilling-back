require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Business = require('./models/Business');
const Invoice = require('./models/Invoice');

const fixExistingInvoiceNumbers = async () => {
    try {
        await connectDB();
        console.log('Connected to Database...');

        const business = await Business.findOne();
        if (!business) {
            console.error('No business profile found.');
            process.exit(1);
        }

        // Get all INVOICE documents, sorted by creation date (ascending)
        const invoices = await Invoice.find({
            business: business._id,
            type: 'INVOICE'
        }).sort({ createdAt: 1 });

        console.log(`Found ${invoices.length} existing invoices.`);

        // We want the MOST RECENT invoice to be RNV-INV-53 (if the next is 54)
        // Or do you want them numbered starting from 1 up to 53?
        // Usually, users want the existing ones to lead up to the new number.
        // If there are 7 invoices, and the next one is 54, then the existing ones 
        // should be numbered 47, 48, 49, 50, 51, 52, 53.

        const nextCounter = 54;
        const totalInvoices = invoices.length;
        const startingNumber = nextCounter - totalInvoices;

        console.log(`Renumbering invoices from ${startingNumber} to ${nextCounter - 1}...`);

        for (let i = 0; i < totalInvoices; i++) {
            const inv = invoices[i];
            const newNumValue = startingNumber + i;
            const newInvoiceNumber = `RNV-INV-${String(newNumValue).padStart(4, '0')}`;

            console.log(`Updating ID: ${inv._id} | Old Num: ${inv.invoiceNumber} -> New Num: ${newInvoiceNumber}`);

            // Update using findOneAndUpdate to bypass some potential issues with the 'save' hook 
            // recalculating things we don't want, or just update the field directly.
            await Invoice.findByIdAndUpdate(inv._id, { invoiceNumber: newInvoiceNumber });
        }

        console.log('Update complete.');
        process.exit(0);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

fixExistingInvoiceNumbers();
