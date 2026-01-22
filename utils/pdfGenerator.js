const PDFDocument = require('pdfkit');
const Invoice = require('../models/Invoice');

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

        // Check if invoice belongs to user
        if (invoice.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        // Create PDF document
        const doc = new PDFDocument({ margin: 50 });

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`
        );

        // Pipe PDF to response
        doc.pipe(res);

        // Helper function to format currency
        const formatCurrency = (amount) => {
            return `₹${amount.toFixed(2)}`;
        };

        // Helper function to format date
        const formatDate = (date) => {
            return new Date(date).toLocaleDateString('en-IN');
        };

        // Colors
        const primaryColor = '#2C3E50';
        const secondaryColor = '#34495E';
        const accentColor = '#3498DB';

        // Header
        doc
            .fontSize(24)
            .fillColor(primaryColor)
            .text(invoice.business.businessName, 50, 50, { bold: true });

        doc
            .fontSize(10)
            .fillColor(secondaryColor)
            .text(
                `${invoice.business.address?.street || ''}, ${invoice.business.address?.city || ''
                }`,
                50,
                80
            )
            .text(
                `${invoice.business.address?.state || ''} - ${invoice.business.address?.pincode || ''
                }`,
                50,
                95
            )
            .text(`GSTIN: ${invoice.business.gstin}`, 50, 110)
            .text(`Phone: ${invoice.business.contact?.phone || ''}`, 50, 125)
            .text(`Email: ${invoice.business.contact?.email || ''}`, 50, 140);

        // Invoice title
        doc
            .fontSize(20)
            .fillColor(accentColor)
            .text(
                invoice.type === 'QUOTATION' ? 'QUOTATION' : 'TAX INVOICE',
                400,
                50,
                { align: 'right' }
            );

        // Invoice details
        doc
            .fontSize(10)
            .fillColor(secondaryColor)
            .text(`${invoice.type === 'QUOTATION' ? 'Quotation No' : 'Invoice No'}: ${invoice.invoiceNumber}`, 400, 80, { align: 'right' })
            .text(`Date: ${formatDate(invoice.invoiceDate)}`, 400, 95, {
                align: 'right',
            });

        if (invoice.dueDate) {
            doc.text(`Due Date: ${formatDate(invoice.dueDate)}`, 400, 110, {
                align: 'right',
            });
        }

        // Line separator
        doc
            .strokeColor('#BDC3C7')
            .lineWidth(1)
            .moveTo(50, 170)
            .lineTo(550, 170)
            .stroke();

        // Customer details
        doc
            .fontSize(12)
            .fillColor(primaryColor)
            .text('Bill To:', 50, 190, { bold: true });

        doc
            .fontSize(10)
            .fillColor(secondaryColor)
            .text(invoice.customer.name, 50, 210)
            .text(
                `${invoice.customer.address?.street || ''}, ${invoice.customer.address?.city || ''
                }`,
                50,
                225
            )
            .text(
                `${invoice.customer.address?.state || ''} - ${invoice.customer.address?.pincode || ''
                }`,
                50,
                240
            );

        if (invoice.customer.gstin) {
            doc.text(`GSTIN: ${invoice.customer.gstin}`, 50, 255);
        }

        doc.text(`Phone: ${invoice.customer.phone}`, 50, 270);

        // Items table
        const tableTop = 320;
        const tableHeaders = [
            { label: 'S.No', x: 50, width: 30 },
            { label: 'Description', x: 80, width: 140 },
            { label: 'Part no', x: 220, width: 80 },
            { label: 'Tool', x: 300, width: 100 },
            { label: 'Price', x: 400, width: 70 },
            { label: 'Amount', x: 470, width: 80 },
        ];

        // Table header background
        doc
            .fillColor('#f8f9fa')
            .rect(50, tableTop - 5, 500, 20)
            .fill();

        // Table header text
        doc.fontSize(10).fillColor(primaryColor).font('Helvetica-Bold');
        tableHeaders.forEach((header) => {
            doc.text(header.label, header.x, tableTop, {
                width: header.width,
                align: header.label === 'Amount' || header.label === 'Price' ? 'right' : 'left',
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
        doc.fontSize(9).fillColor(secondaryColor).font('Helvetica');

        invoice.items.forEach((item, index) => {
            const processes = item.processes || [];
            const processesHeight = processes.length > 0 ? (processes.length * 15) : 20;
            const rowHeight = Math.max(25, doc.heightOfString(item.productName, { width: 140 }) + 10, processesHeight + 10);

            if (yPosition + rowHeight > 750) {
                doc.addPage();
                yPosition = 50;
            }

            doc.text(String(index + 1), 50, yPosition, { width: 30 });
            doc.text(item.productName, 80, yPosition, { width: 140 });
            doc.text(item.hsnCode || '-', 220, yPosition, { width: 80 });

            // Render Processes
            if (processes.length > 0) {
                let processY = yPosition;
                processes.forEach(p => {
                    doc.text(p.name, 300, processY, { width: 100 });
                    doc.text(formatCurrency(p.price), 400, processY, { width: 70, align: 'right' });
                    processY += 15;
                });
            } else {
                doc.text(item.tool || '-', 300, yPosition, { width: 100 });
                doc.text(formatCurrency(item.price), 400, yPosition, { width: 70, align: 'right' });
            }

            doc.text(formatCurrency(item.price * item.quantity), 470, yPosition, {
                width: 80,
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

        // Table footer line
        doc
            .strokeColor('#BDC3C7')
            .lineWidth(1)
            .moveTo(50, yPosition)
            .lineTo(550, yPosition)
            .stroke();

        yPosition += 15;

        // Totals
        doc.fontSize(10).fillColor(secondaryColor);

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
        doc.fontSize(12).fillColor(primaryColor);
        doc.text('Total:', 400, yPosition, { bold: true });
        doc.text(formatCurrency(invoice.total), 460, yPosition, {
            width: 90,
            align: 'right',
            bold: true,
        });

        yPosition += 35;

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

        doc
            .fontSize(10)
            .fillColor(primaryColor)
            .text('Value in Words:', 50, yPosition, { bold: true });

        doc
            .fontSize(10)
            .fillColor(secondaryColor)
            .text(numberToWords(invoice.total), 135, yPosition, { width: 400 });

        yPosition += 25;

        // Payment status
        if (invoice.paidAmount > 0) {
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
            yPosition += 20;
            doc.fontSize(10).fillColor(primaryColor).text('Notes:', 50, yPosition);
            yPosition += 15;
            doc
                .fontSize(9)
                .fillColor(secondaryColor)
                .text(invoice.notes, 50, yPosition, { width: 500 });
        }

        // Terms and conditions
        if (invoice.termsAndConditions) {
            yPosition += 40;
            if (yPosition > 700) {
                doc.addPage();
                yPosition = 50;
            }
            doc
                .fontSize(10)
                .fillColor(primaryColor)
                .text('Terms & Conditions:', 50, yPosition);
            yPosition += 15;
            doc
                .fontSize(9)
                .fillColor(secondaryColor)
                .text(invoice.termsAndConditions, 50, yPosition, { width: 500 });
        }

        // Bank details
        if (invoice.business.bankDetails?.accountNumber) {
            yPosition += 40;
            if (yPosition > 700) {
                doc.addPage();
                yPosition = 50;
            }
            doc
                .fontSize(10)
                .fillColor(primaryColor)
                .text('Bank Details:', 50, yPosition);
            yPosition += 15;
            doc
                .fontSize(9)
                .fillColor(secondaryColor)
                .text(
                    `Account Name: ${invoice.business.bankDetails.accountName || ''}`,
                    50,
                    yPosition
                );
            yPosition += 15;
            doc.text(
                `Account Number: ${invoice.business.bankDetails.accountNumber}`,
                50,
                yPosition
            );
            yPosition += 15;
            doc.text(
                `IFSC Code: ${invoice.business.bankDetails.ifscCode || ''}`,
                50,
                yPosition
            );
            yPosition += 15;
            doc.text(
                `Bank: ${invoice.business.bankDetails.bankName || ''}, ${invoice.business.bankDetails.branch || ''
                }`,
                50,
                yPosition
            );
        }

        // Footer
        const pageHeight = doc.page.height;
        doc
            .fontSize(8)
            .fillColor('#95A5A6')
            .text(
                'This is a computer-generated invoice and does not require a signature.',
                50,
                pageHeight - 50,
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
