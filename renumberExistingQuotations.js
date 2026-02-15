require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Business = require('./models/Business');
const Invoice = require('./models/Invoice');

const fixExistingQuotationNumbers = async () => {
    try {
        console.log('Connecting to DB...');
        await connectDB();
        console.log('Connected to Database...');

        const business = await Business.findOne();
        if (!business) {
            console.error('No business profile found.');
            process.exit(1);
        }

        // Get all QUOTATION documents, sorted by creation date (ascending)
        const quotations = await Invoice.find({
            business: business._id,
            type: 'QUOTATION'
        }).sort({ createdAt: 1 });

        console.log(`Found ${quotations.length} existing quotations.`);

        const prefix = business.quotationPrefix || 'RNV-QTN';
        console.log(`Renumbering quotations starting from 1 with prefix ${prefix}...`);

        for (let i = 0; i < quotations.length; i++) {
            const quote = quotations[i];
            const newNumValue = i + 1;
            // Pad to 3 digits as requested "001"
            const newQuotationNumber = `${prefix}-${String(newNumValue).padStart(3, '0')}`;

            console.log(`Updating ID: ${quote._id} | Old Num: ${quote.invoiceNumber} -> New Num: ${newQuotationNumber}`);

            await Invoice.findByIdAndUpdate(quote._id, { invoiceNumber: newQuotationNumber });
        }

        // Update the business counter
        business.quotationCounter = quotations.length;
        await business.save();
        console.log(`Updated business quotationCounter to ${business.quotationCounter}`);

        console.log('Update complete.');
        process.exit(0);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

fixExistingQuotationNumbers();
