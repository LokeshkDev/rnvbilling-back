const express = require('express');
const router = express.Router();
const {
    getBusiness,
    createOrUpdateBusiness,
    uploadLogo,
    upload,
} = require('../controllers/businessController');
const { protect } = require('../middleware/auth');

router
    .route('/')
    .get(protect, getBusiness)
    .post(protect, createOrUpdateBusiness);

router.post('/logo', protect, upload.single('logo'), uploadLogo);

module.exports = router;
