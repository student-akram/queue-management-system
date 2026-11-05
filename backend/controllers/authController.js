const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Manager } = require("../models");

// REGISTER
const registerManager = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email, and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    // Check whether manager already exists
    const existingManager = await Manager.findOne({
      where: { email },
    });

    if (existingManager) {
      return res.status(409).json({
        message: "Email is already registered",
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create manager
    const manager = await Manager.create({
      name,
      email,
      passwordHash,
    });

    return res.status(201).json({
      message: "Manager registered successfully",
      manager: {
        id: manager.id,
        name: manager.name,
        email: manager.email,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      message: "Server error during registration",
    });
  }
};

// LOGIN
const loginManager = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    // Find manager
    const manager = await Manager.findOne({
      where: { email },
    });

    if (!manager) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Compare password with stored hash
    const isPasswordValid = await bcrypt.compare(
      password,
      manager.passwordHash
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        managerId: manager.id,
        email: manager.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      manager: {
        id: manager.id,
        name: manager.name,
        email: manager.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      message: "Server error during login",
    });
  }
};

module.exports = {
  registerManager,
  loginManager,
};