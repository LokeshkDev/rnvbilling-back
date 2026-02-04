require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Business = require('./models/Business');
const Invoice = require('./models/Invoice');

const updateInvoiceNumbers = async () => {
    try {
        await connectDB();
        console.log('Connected to Database...');

        // 1. Find the admin business profile
        // Get the business from the seed script email if possible, or just the first one
        const business = await Business.findOne();
        if (!business) {
            console.error('No business profile found. Please create one first.');
            process.exit(1);
        }

        console.log(`Updating business: ${business.businessName}`);

        // 2. Set new prefix and starting counter
        // The user wants RNV-INV-54, RNV-INV-53 etc.
        // I will set prefix to "RNV-INV" and counter to 53 so next one is 54.
        business.invoicePrefix = 'RNV-INV';
        business.invoiceCounter = 53;
        await business.save();
        console.log('Updated business prefix to RNV-INV and counter to 53.');

        // 3. Find existing invoices and update their numbers if they aren't already correct
        // Note: The user said "add that from already existing from also"
        // This usually means correcting existing ones to match the new format.
        const invoices = await Invoice.find({ business: business._id }).sort({ createdAt: 1 });
        console.log(`Found ${invoices.length} invoices to check.`);

        for (let i = 0; i < invoices.length; i++) {
            const inv = invoices[i];
            const currentNum = i + 1; // Simplified: re-numbering based on creation order
            // If the user wants to keep original numbers but change prefix:
            const oldNumberPart = inv.invoiceNumber.split('-').pop(); // Get last part
            const newInvoiceNumber = `RNV-INV-${oldNumberPart.padStart(2, '0')}`;

            console.log(`Updating ${inv.invoiceNumber} -> ${newInvoiceNumber}`);
            inv.invoiceNumber = newInvoiceNumber;

            // To avoid unique constraint errors if numbers overlap during update, 
            // you might need a temporary prefix. But here we assume we are moving to a new format.
            try {
                await inv.save();
            } catch (err) {
                console.error(`Error saving invoice ${newInvoiceNumber}: ${err.message}`);
            }
        }

        console.log('Finished updating existing invoices.');
        process.exit(0);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

updateInvoiceNumbers();
