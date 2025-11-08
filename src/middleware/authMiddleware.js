import jwt from "jsonwebtoken";
import User from "../models/User.js"; // renamed from User.model.js to User.js if following earlier structure

const userMiddleware = async (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized - No token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized - Invalid token" });
    }

    req.userId = decoded.id;

    const result = await User.findById(req.userId);
    if (!result) {
      return res
        .status(401)
        .json({ success: false, message: "User does not exist" });
    }

    req.result = result;
    next(); // ✅ Continue to the next middleware or route
  } catch (error) {
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized - Token error" });
  }
};

export default userMiddleware;
