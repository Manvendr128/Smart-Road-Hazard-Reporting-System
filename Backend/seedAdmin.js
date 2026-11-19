/**
 * Trusted Admin Provisioning Script
 * Usage: node seedAdmin.js [email] [password]
 * Example: node seedAdmin.js admin@smartroad.gov AdminPassword123
 */

require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./src/model/User");

const seedAdmin = async () => {
  const email = (process.argv[2] || "manvendra123@gmail.com").toLowerCase().trim();
  const password = process.argv[3] || "Admin@123";
  const name = process.argv[4] || "Administrator";
  const phone = process.argv[5] || "9876543210";

  if (!process.env.MONGO_URI) {
    console.error("Error: MONGO_URI is missing in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    let user = await User.findOne({ email }).select("+password");

    if (user) {
      console.log(`Found existing user with email ${email}. Updating to admin role and setting password...`);
      user.role = "admin";
      user.password = password; // pre-save hook hashes it
      if (!user.name) user.name = name;
      if (!user.phone) user.phone = phone;
      await user.save();
      console.log(`Admin account '${email}' updated successfully.`);
    } else {
      console.log(`Creating new trusted admin account '${email}'...`);
      user = await User.create({
        name,
        email,
        phone,
        password,
        role: "admin",
      });
      console.log(`Admin account '${email}' created successfully.`);
    }

    console.log("Provisioning complete. Role:", user.role);
    process.exit(0);
  } catch (err) {
    console.error("Admin provisioning error:", err);
    process.exit(1);
  }
};

seedAdmin();
