require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');

const createAdminUser = async () => {
    try {
        await connectDB();

        const adminEmail = 'rnvtoolsadntraders@gmail.com';
        const adminPassword = 'admin123';
        const adminName = 'Super Admin';

        // Check if user exists
        const userExists = await User.findOne({ email: adminEmail });

        if (userExists) {
            console.log('Admin user already exists.');

            // Optional: Update the existing admin to ensure it has admin role
            if (userExists.role !== 'admin') {
                userExists.role = 'admin';
                await userExists.save();
                console.log('Updated existing user to admin role.');
            }

            process.exit(0);
        }

        // Create new admin user
        const user = await User.create({
            name: adminName,
            email: adminEmail,
            password: adminPassword,
            role: 'admin',
            isActive: true
        });

        console.log('-----------------------------------');
        console.log('Admin User Created Successfully!');
        console.log('-----------------------------------');
        console.log(`Email:    ${user.email}`);
        console.log(`Password: ${adminPassword}`);
        console.log(`Role:     ${user.role}`);
        console.log('-----------------------------------');

        process.exit(0);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

createAdminUser();
