import express from "express";
import {
  createPost,
  getPosts,
  getPostById,
  addReply,
  upvotePost,
} from "../controllers/postController.js";
import userMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getPosts);
router.get("/:id", getPostById);
router.post("/", userMiddleware, createPost);
router.post("/:id/reply", userMiddleware, addReply);
router.post("/:id/upvote", userMiddleware, upvotePost);

export default router;
