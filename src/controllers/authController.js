import jwt from "jsonwebtoken";
import User from "../models/User.js";

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const user = await User.create({ name, email, password });

    const token = generateToken(user._id);
    
    // Set cookie with environment-aware settings
    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("token", token, {
      maxAge: 7 * 24 * 60 * 60 * 1000, // ✅ 7 days
      httpOnly: true, // ✅ Prevent JS access (security)
      sameSite: isProduction ? "none" : "lax", // ✅ Lax for localhost, none for production
      secure: isProduction, // ✅ Only secure in production (HTTPS)
    });
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      const token = generateToken(user._id);
      
      // Set cookie (same settings as register)
      const isProduction = process.env.NODE_ENV === "production";
      res.cookie("token", token, {
        maxAge: 7 * 24 * 60 * 60 * 1000, // ✅ 7 days
        httpOnly: true, // ✅ Prevent JS access (security)
        sameSite: isProduction ? "none" : "lax", // ✅ Lax for localhost, none for production
        secure: isProduction, // ✅ Only secure in production (HTTPS)
      });
      
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
      });
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get current user (check authentication)
export const getMe = async (req, res) => {
  try {
    // userMiddleware should have already set req.userId and req.result
    const user = req.result;
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Logout user
export const logoutUser = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
    });
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
