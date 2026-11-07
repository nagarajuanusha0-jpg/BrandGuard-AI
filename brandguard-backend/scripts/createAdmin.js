
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const User = require("../src/models/User");
const connectDB = require("../src/config/db");

const readline = require("readline/promises");
const { stdin, stdout } = require("process");

const rl = readline.createInterface({ input: stdin, output: stdout });

const createAdmin = async () => {
  try {
    await connectDB();

    const name = await rl.question("Enter Admin name: ");
    const email = (await rl.question("Enter Admin email: "))
      .trim()
      .toLowerCase();
    const password = await rl.question("Enter Admin password: ");

    if (!name.trim() || !email || !password) {
      throw new Error("All fields are required.");
    }

    if (password.length < 12) {
      throw new Error("Admin password must be at least 12 characters.");
    }

    const existingAdmin = await User.findOne({ role: "Admin" });

    if (existingAdmin) {
      console.log("An Admin account already exists.");
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await User.create({
      name: name.trim(),
      email,
      passwordHash,
      role: "Admin",
      status: "Active",
    });

    console.log("Admin account created successfully!");
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    rl.close();
    await mongoose.disconnect();
  }
};

createAdmin();
