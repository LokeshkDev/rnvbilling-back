const Business = require('../models/Business');
const multer = require('multer');
const path = require('path');

// Configure multer for logo upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, `logo-${Date.now()}${path.extname(file.originalname)}`);
    },
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5000000 }, // 5MB
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png/;
        const extname = filetypes.test(
            path.extname(file.originalname).toLowerCase()
        );
        const mimetype = filetypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb('Error: Images only (jpeg, jpg, png)!');
        }
    },
});

// @desc    Get business profile
// @route   GET /api/business
// @access  Private
const getBusiness = async (req, res) => {
    try {
        const business = await Business.findOne({ user: req.user._id });

        if (!business) {
            return res.json(null);
        }

        // Map back to frontend structure
        const flatBusiness = {
            ...business.toObject(),
            name: business.businessName,
            gstNumber: business.gstin,
            panNumber: business.pan,
            address: business.address?.street || '',
            email: business.contact?.email || '',
            phone: business.contact?.phone || '',
            website: business.contact?.website || '',
            bankName: business.bankDetails?.bankName || '',
            accountName: business.bankDetails?.accountName || '',
            accountNumber: business.bankDetails?.accountNumber || '',
            ifscCode: business.bankDetails?.ifscCode || '',
            branchName: business.bankDetails?.branch || '',
            // Theme settings
            primaryColor: business.theme?.primaryColor || '#2C3E50',
            secondaryColor: business.theme?.secondaryColor || '#34495E',
            accentColor: business.theme?.accentColor || '#3498DB',
            businessNameColor: business.theme?.businessNameColor || '#2C3E50',
            font: business.theme?.font || 'Helvetica',
            titleFontSize: business.theme?.titleFontSize || 24,
            bodyFontSize: business.theme?.bodyFontSize || 10,
            // logo and termsAndConditions are at root, so they carry over
        };

        res.json(flatBusiness);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create or update business profile
// @route   POST /api/business
// @access  Private
const createOrUpdateBusiness = async (req, res) => {
    try {
        const {
            name,
            gstNumber,
            address,
            email,
            phone,
            website,
            bankName,
            accountName,
            accountNumber,
            ifscCode,
            branchName,
            termsAndConditions,
            panNumber, // Map PAN if present,
            // Theme settings
            primaryColor,
            secondaryColor,
            accentColor,
            businessNameColor,
            font,
            titleFontSize,
            bodyFontSize
        } = req.body;

        const businessData = {
            user: req.user._id,
            businessName: name,
            gstin: gstNumber,
            pan: panNumber,
            address: {
                street: address
            },
            contact: {
                email,
                phone,
                website
            },
            bankDetails: {
                bankName,
                accountName,
                accountNumber,
                ifscCode,
                branch: branchName
            },
            termsAndConditions,
            theme: {
                primaryColor,
                secondaryColor,
                accentColor,
                businessNameColor,
                font,
                titleFontSize,
                bodyFontSize
            }
        };

        let business = await Business.findOne({ user: req.user._id });

        if (business) {
            // Update existing business
            business = await Business.findOneAndUpdate(
                { user: req.user._id },
                { $set: businessData },
                { new: true, runValidators: true }
            );
        } else {
            // Create new business
            business = await Business.create(businessData);
        }

        res.json(business);
    } catch (error) {
        console.error("Business Create/Update Error:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Upload business logo
// @route   POST /api/business/logo
// @access  Private
const uploadLogo = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Please upload a file' });
        }

        const business = await Business.findOne({ user: req.user._id });

        if (!business) {
            return res.status(404).json({ message: 'Business profile not found' });
        }

        business.logo = `/uploads/${req.file.filename}`;
        await business.save();

        res.json({ logo: business.logo });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getBusiness,
    createOrUpdateBusiness,
    uploadLogo,
    upload,
};
