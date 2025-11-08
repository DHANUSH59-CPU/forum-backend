import express from "express";
import {
  registerUser,
  loginUser,
  getMe,
  logoutUser,
} from "../controllers/authController.js";
import userMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", userMiddleware, getMe); // Protected route - requires authentication
router.post("/logout", logoutUser);

export default router;
