const PDFDocument = require('pdfkit');
const Invoice = require('../models/Invoice');
const fs = require('fs');
const path = require('path');

// @desc    Generate invoice PDF
// @route   GET /api/invoices/:id/pdf
// @access  Private
const generateInvoicePDF = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id)
            .populate('customer')
            .populate('business');

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        if (!invoice.business) {
            return res.status(400).json({ message: 'Business profile not found. Please complete your profile first.' });
        }

        if (!invoice.customer) {
            return res.status(400).json({ message: 'Customer not found' });
        }

        // Check if invoice belongs to user
        if (invoice.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        // Create PDF document
        const doc = new PDFDocument({ margin: 50 });

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');

        const customerName = invoice.customer?.name || 'Customer';
        const safeCustomerName = customerName.replace(/[^a-z0-9]/gi, '_');

        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${safeCustomerName}.pdf"`
        );

        // Pipe PDF to response
        doc.pipe(res);

        // Determine Font paths based on environment
        // Determine Font paths based on environment or theme
        const theme = invoice.business.theme || {};
        const baseFont = theme.font || 'Helvetica';

        // If using standard fonts, we don't need paths
        const standardFonts = ['Helvetica', 'Courier', 'Times-Roman'];
        let fontRegular = baseFont;
        let fontBold = `${baseFont}-Bold`;

        if (!standardFonts.includes(baseFont)) {
            // Fallback to system fonts logic if it was a custom attempt (though we only offer standard for now)
            const windowsFonts = {
                regular: 'C:/Windows/Fonts/arial.ttf',
                bold: 'C:/Windows/Fonts/arialbd.ttf'
            };

            const linuxFonts = {
                regular: '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
                bold: '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'
            };

            if (fs.existsSync(windowsFonts.regular)) {
                fontRegular = windowsFonts.regular;
                fontBold = fs.existsSync(windowsFonts.bold) ? windowsFonts.bold : fontRegular;
            } else if (fs.existsSync(linuxFonts.regular)) {
                fontRegular = linuxFonts.regular;
                fontBold = fs.existsSync(linuxFonts.bold) ? linuxFonts.bold : fontRegular;
            }
        }

        // Helper function to format currency
        const formatCurrency = (amount) => {
            const sym = fontRegular !== 'Helvetica' ? '\u20B9' : 'Rs.';
            return `${sym} ${new Intl.NumberFormat('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(amount)}`;
        };

        // Helper function to format date
        const formatDate = (date) => {
            return new Date(date).toLocaleDateString('en-IN');
        };

        // Colors
        // Colors & Sizes from Theme
        const primaryColor = theme.primaryColor || '#2C3E50';
        const secondaryColor = theme.secondaryColor || '#34495E';
        const accentColor = theme.accentColor || '#3498DB';
        const businessNameColor = theme.businessNameColor || theme.primaryColor || '#2C3E50';
        const titleFontSize = theme.titleFontSize || 24;
        const bodyFontSize = theme.bodyFontSize || 10;

        // Header
        doc
            .font(fontBold)
            .fontSize(titleFontSize)
            .fillColor(businessNameColor)
            .text(invoice.business.businessName, 50, 50);

        doc
            .font(fontRegular)
            .fontSize(bodyFontSize)
            .fillColor(secondaryColor)
            .text(`${invoice.business.address?.street || ''}, ${invoice.business.address?.city || ''}`, 50, 80, { width: 300 })
            .text(`${invoice.business.address?.state || ''} - ${invoice.business.address?.pincode || ''}`, { width: 300 })
            .text(`GSTIN: ${invoice.business.gstin}`, { width: 300 })
            .text(`Phone: ${invoice.business.contact?.phone || ''}`, { width: 300 })
            .text(`Email: ${invoice.business.contact?.email || ''}`, { width: 300 });

        // Capture left side height
        const headerBottomY = doc.y;

        // Invoice title
        doc
            .font(fontBold)
            .fontSize(20)
            .fillColor(accentColor)
            .text(
                invoice.type === 'QUOTATION' ? 'QUOTATION' : 'INVOICE',
                400,
                50,
                { align: 'right' }
            );

        // Invoice details
        const getDisplayNumber = (num) => {
            const expectedTypePrefix = invoice.type === 'QUOTATION' ? 'RNV-QTN-' : 'RNV-INV-';

            // If it already starts with the right prefix, return as is
            if (num.startsWith(expectedTypePrefix)) return num;

            // Strip any existing RNV-INV- or RNV-QTN- or INV- or QTN-
            const cleanNum = num.replace(/^RNV-(INV|QTN)-/, '').replace(/^(INV|QTN)-/, '');

            return `${expectedTypePrefix}${cleanNum}`;
        };

        doc
            .fontSize(10)
            .fillColor(secondaryColor)
            .text(`${invoice.type === 'QUOTATION' ? 'Quotation No' : 'Invoice No'}: ${getDisplayNumber(invoice.invoiceNumber)}`, 400, 80, { align: 'right' })
            .text(`Date: ${formatDate(invoice.invoiceDate)}`, 400, doc.y, { align: 'right' });

        if (invoice.dueDate) {
            doc.text(`Due Date: ${formatDate(invoice.dueDate)}`, 400, doc.y, { align: 'right' });
        }

        // E-way Bill details if present
        if (invoice.ewayBillNo) {
            doc.text(`E-Way Bill No: ${invoice.ewayBillNo}`, 400, doc.y, { align: 'right' });
            if (invoice.vehicleNo) {
                doc.text(`Vehicle No: ${invoice.vehicleNo}`, 400, doc.y, { align: 'right' });
            }
            if (invoice.transportMode) {
                doc.text(`Mode: ${invoice.transportMode}`, 400, doc.y, { align: 'right' });
            }
        }

        const detailsBottomY = doc.y;

        // Line separator (Reduced padding)
        const separatorY = Math.max(headerBottomY, detailsBottomY) + 5;
        doc
            .strokeColor('#BDC3C7')
            .lineWidth(1)
            .moveTo(50, separatorY)
            .lineTo(550, separatorY)
            .stroke();

        // Customer details
        doc
            .fontSize(12)
            .fillColor(primaryColor)
            .font(fontBold)
            .text('Bill To:', 50, separatorY + 5);

        doc
            .font(fontRegular)
            .fontSize(10)
            .text(invoice.customer.name, 50, doc.y + 2, { width: 320 })
            .text(`${invoice.customer.address?.street || ''}, ${invoice.customer.address?.city || ''}`, { width: 320 })
            .text(`${invoice.customer.address?.state || ''} - ${invoice.customer.address?.pincode || ''}`, { width: 320 });

        if (invoice.customer.gstin) {
            doc.text(`GSTIN: ${invoice.customer.gstin}`, { width: 320 });
        }

        doc.text(`Phone: ${invoice.customer.phone}`, { width: 320 });

        // Border line below customer address
        const addressBottomY = doc.y + 5;
        doc
            .strokeColor('#BDC3C7')
            .lineWidth(0.5)
            .moveTo(50, addressBottomY)
            .lineTo(550, addressBottomY)
            .stroke();

        // Items table
        const tableTop = addressBottomY + 5;

        // Determine if we should show Part no column
        const hasPartNo = invoice.items.some(item => item.hsnCode && item.hsnCode.trim() !== '' && item.hsnCode !== '-');

        const tableHeaders = [
            { label: 'S.No', x: 50, width: 30 },
            { label: 'Description', x: 80, width: hasPartNo ? 120 : 160 },
        ];

        if (hasPartNo) {
            tableHeaders.push({ label: 'Part no', x: 200, width: 60 });
        }

        const toolX = hasPartNo ? 260 : 240;
        const toolWidth = hasPartNo ? 90 : 110;

        tableHeaders.push({ label: 'Tool', x: toolX, width: toolWidth });
        tableHeaders.push({ label: 'Qty', x: 350, width: 40 });
        tableHeaders.push({ label: 'Price', x: 390, width: 70 });
        tableHeaders.push({ label: 'Amount', x: 460, width: 90 });

        // Table header background
        doc
            .fillColor('#f8f9fa')
            .rect(50, tableTop - 5, 500, 20)
            .fill();

        // Table header text
        doc.fontSize(10).fillColor(primaryColor).font(fontBold);
        tableHeaders.forEach((header) => {
            doc.text(header.label, header.x, tableTop, {
                width: header.width,
                align: header.label === 'Amount' || header.label === 'Price' || header.label === 'Qty' ? 'right' : 'left',
            });
        });

        // Table header line
        doc
            .strokeColor('#2C3E50')
            .lineWidth(1)
            .moveTo(50, tableTop + 15)
            .lineTo(550, tableTop + 15)
            .stroke();

        // Table rows
        let yPosition = tableTop + 25;
        doc.fontSize(9).fillColor(secondaryColor).font(fontRegular);

        invoice.items.forEach((item, index) => {
            const validProcesses = (item.processes || []).filter(p => (p.name && p.name.trim() !== '') || (p.price && p.price > 0));
            const hasTool = item.tool && item.tool.trim() !== '';

            let toolLines = 0;
            if (hasTool) toolLines += 1;
            toolLines += validProcesses.length;
            if (toolLines === 0) toolLines = 1; // for '-'

            const toolColumnHeight = toolLines * 15;
            const descriptionWidth = hasPartNo ? 120 : 160;
            const rowHeight = Math.max(25, doc.heightOfString(item.productName, { width: descriptionWidth }) + 10, toolColumnHeight + 10);

            if (yPosition + rowHeight > doc.page.height - 70) {
                doc.addPage();
                yPosition = 50;
            }

            doc.text(String(index + 1), 50, yPosition, { width: 30 });
            doc.text(item.productName, 80, yPosition, { width: descriptionWidth });

            if (hasPartNo) {
                doc.text(item.hsnCode || '-', 200, yPosition, { width: 60 });
            }

            // Render Tool & Processes
            let currentToolY = yPosition;
            if (hasTool) {
                doc.text(item.tool, toolX, currentToolY, { width: toolWidth });
                // If it's just the tool and no processes, we might want to show the unit price if processes are empty
                if (validProcesses.length === 0) {
                    doc.text(formatCurrency(item.price), 390, currentToolY, { width: 70, align: 'right' });
                }
                currentToolY += 15;
            }

            if (validProcesses.length > 0) {
                validProcesses.forEach(p => {
                    doc.text(p.name || 'Process', toolX, currentToolY, { width: toolWidth });
                    doc.text(formatCurrency(p.price), 390, currentToolY, { width: 70, align: 'right' });
                    currentToolY += 15;
                });
            } else if (!hasTool) {
                doc.text('-', toolX, yPosition, { width: toolWidth });
                doc.text(formatCurrency(item.price), 390, yPosition, { width: 70, align: 'right' });
            }

            // Quantity
            doc.text(String(item.quantity), 350, yPosition, { width: 40, align: 'right' });

            // Amount (Total for this item)
            doc.text(formatCurrency(item.price * item.quantity), 460, yPosition, {
                width: 90,
                align: 'right',
            });

            // Draw horizontal line after each row
            doc
                .strokeColor('#eee')
                .lineWidth(0.5)
                .moveTo(50, yPosition + rowHeight - 5)
                .lineTo(550, yPosition + rowHeight - 5)
                .stroke();

            yPosition += rowHeight;
        });

        // Helper to check for space and add page
        const checkPageBreak = (neededHeight) => {
            if (yPosition + neededHeight > doc.page.height - 70) {
                doc.addPage();
                yPosition = 50;
                return true;
            }
            return false;
        };

        // Table footer line
        doc
            .strokeColor('#BDC3C7')
            .lineWidth(1)
            .moveTo(50, yPosition)
            .lineTo(550, yPosition)
            .stroke();

        yPosition += 20;

        // Calculate height needed for totals
        let totalsHeight = 80; // Basic height for Subtotal and Total
        if (invoice.cgst > 0) totalsHeight += 40;
        if (invoice.igst > 0) totalsHeight += 20;
        if (invoice.paidAmount > 0) totalsHeight += 40;

        checkPageBreak(totalsHeight);

        // Totals
        doc.fontSize(10).fillColor(secondaryColor).font(fontRegular);

        doc.text('Subtotal:', 400, yPosition);
        doc.text(formatCurrency(invoice.subtotal), 460, yPosition, {
            width: 90,
            align: 'right',
        });
        yPosition += 20;

        if (invoice.cgst > 0) {
            doc.text('CGST:', 400, yPosition);
            doc.text(formatCurrency(invoice.cgst), 460, yPosition, {
                width: 90,
                align: 'right',
            });
            yPosition += 20;

            doc.text('SGST:', 400, yPosition);
            doc.text(formatCurrency(invoice.sgst), 460, yPosition, {
                width: 90,
                align: 'right',
            });
            yPosition += 20;
        }

        if (invoice.igst > 0) {
            doc.text('IGST:', 400, yPosition);
            doc.text(formatCurrency(invoice.igst), 460, yPosition, {
                width: 90,
                align: 'right',
            });
            yPosition += 20;
        }

        // Total line
        doc
            .strokeColor('#BDC3C7')
            .lineWidth(1)
            .moveTo(400, yPosition)
            .lineTo(550, yPosition)
            .stroke();

        yPosition += 10;

        // Grand total
        doc.fontSize(12).fillColor(primaryColor).font(fontBold);
        doc.text('Total:', 400, yPosition);
        doc.text(formatCurrency(invoice.total), 460, yPosition, {
            width: 90,
            align: 'right',
            bold: true,
        });

        yPosition += 40;

        // Value in Words
        const numberToWords = (num) => {
            const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
            const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

            const inWords = (n) => {
                if (n < 20) return a[n];
                if (n < 100) return b[Math.floor(n / 10)] + ' ' + a[n % 10];
                if (n < 1000) return a[Math.floor(n / 100)] + 'Hundred ' + inWords(n % 100);
                if (n < 100000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + inWords(n % 1000);
                if (n < 10000000) return inWords(Math.floor(n / 100000)) + 'Lakh ' + inWords(n % 100000);
                return inWords(Math.floor(n / 10000000)) + 'Crore ' + inWords(n % 10000000);
            };

            const whole = Math.floor(num);
            const fraction = Math.round((num - whole) * 100);
            let str = inWords(whole) + 'Rupees ';
            if (fraction > 0) {
                str += 'and ' + inWords(fraction) + 'Paise ';
            }
            return str + 'Only';
        };

        const words = numberToWords(invoice.total);
        const wordsHeight = doc.heightOfString(words, { width: 400 }) + 20;

        checkPageBreak(wordsHeight);

        doc
            .fontSize(10)
            .fillColor(primaryColor)
            .font(fontBold)
            .text('Value in Words:', 50, yPosition);

        doc
            .fontSize(10)
            .fillColor(secondaryColor)
            .font(fontRegular)
            .text(words, 135, yPosition, { width: 400 });

        yPosition += wordsHeight;

        // Payment status
        if (invoice.paidAmount > 0) {
            checkPageBreak(50);
            doc.fontSize(10).fillColor(secondaryColor);
            doc.text('Paid:', 400, yPosition);
            doc.text(formatCurrency(invoice.paidAmount), 460, yPosition, {
                width: 90,
                align: 'right',
            });
            yPosition += 20;

            doc.text('Balance:', 400, yPosition);
            doc.text(formatCurrency(invoice.balanceAmount), 460, yPosition, {
                width: 90,
                align: 'right',
            });
            yPosition += 20;
        }

        // Notes
        if (invoice.notes) {
            const notesHeight = doc.heightOfString(invoice.notes, { width: 500 }) + 40;
            checkPageBreak(notesHeight);

            doc.fontSize(10).fillColor(primaryColor).font(fontBold).text('Notes:', 50, yPosition);
            yPosition += 15;
            doc
                .fontSize(9)
                .fillColor(secondaryColor)
                .font(fontRegular)
                .text(invoice.notes, 50, yPosition, { width: 500 });
            yPosition += notesHeight - 15;
        }

        // Terms and Bank Details side by side
        const termsWidth = 240;
        const bankWidth = 240;
        const bankX = 310;

        let termsHeight = 0;
        if (invoice.termsAndConditions) {
            termsHeight = doc.heightOfString(invoice.termsAndConditions, { width: termsWidth }) + 30;
        }

        let bankHeight = 0;
        if (invoice.business.bankDetails?.accountNumber) {
            bankHeight = 100; // Estimated height for bank details
        }

        const columnHeight = Math.max(termsHeight, bankHeight);
        checkPageBreak(columnHeight + 40); // Add margin

        const currentY = yPosition + 10;

        // Terms and conditions (Left Column)
        if (invoice.termsAndConditions) {
            doc
                .fontSize(10)
                .fillColor(primaryColor)
                .font(fontBold)
                .text('Terms & Conditions:', 50, currentY);

            doc
                .fontSize(9)
                .fillColor(secondaryColor)
                .font(fontRegular)
                .text(invoice.termsAndConditions, 50, currentY + 15, { width: termsWidth });
        }

        // Bank details (Right Column)
        if (invoice.business.bankDetails?.accountNumber) {
            doc
                .fontSize(10)
                .fillColor(primaryColor)
                .font(fontBold)
                .text('Bank Details:', bankX, currentY);

            doc
                .fontSize(9)
                .fillColor(secondaryColor)
                .font(fontRegular);

            doc.text(`Account Name: ${invoice.business.bankDetails.accountName || ''}`, bankX, currentY + 15, { width: bankWidth });
            doc.text(`Account Number: ${invoice.business.bankDetails.accountNumber}`, bankX, doc.y + 2, { width: bankWidth });
            doc.text(`IFSC Code: ${invoice.business.bankDetails.ifscCode || ''}`, bankX, doc.y + 2, { width: bankWidth });
            doc.text(`Bank: ${invoice.business.bankDetails.bankName || ''}, ${invoice.business.bankDetails.branch || ''}`, bankX, doc.y + 2, { width: bankWidth });
        }

        yPosition = Math.max(doc.y, currentY + columnHeight) + 20;

        // Footer - ONLY on the last page
        const pageHeight = doc.page.height;
        // Disable auto page break for footer to prevent it triggering a new page
        doc.page.margins.bottom = 0;
        doc
            .fontSize(8)
            .fillColor('#95A5A6')
            .font(fontRegular)
            .text(
                'This is a computer-generated invoice and does not require a signature.',
                50,
                pageHeight - 30,
                { align: 'center', width: 500 }
            );

        // Finalize PDF
        doc.end();
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    generateInvoicePDF,
};
