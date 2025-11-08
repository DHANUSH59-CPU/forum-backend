import Post from "../models/Post.js";

// ➕ Create new post
export const createPost = async (req, res) => {
  try {
    const { title, content } = req.body;

    // Validate
    if (!title?.trim() || !content?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Title and content are required" });
    }

    // Create post
    const post = await Post.create({
      user: req.userId,
      title: title.trim(),
      content: content.trim(),
    });

    // Populate user details
    await post.populate("user", "name email");
    
    // Ensure upvotedBy is an array
    if (!post.upvotedBy) {
      post.upvotedBy = [];
    }

    // Convert to plain object for socket emission
    const postData = post.toObject();
    
    // Ensure user data exists (should always exist, but safety check)
    if (!postData.user) {
      // Fallback: get user from database if populate failed
      const User = (await import("../models/User.js")).default;
      const user = await User.findById(req.userId);
      if (user) {
        postData.user = {
          _id: user._id,
          name: user.name,
          email: user.email,
        };
      }
    }

    // Emit real-time event for new post
    req.io?.emit("newPost", postData);

    res.status(201).json({ success: true, data: postData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 📋 Get all posts
export const getPosts = async (req, res) => {
  try {
    const posts = await Post.find()
      .populate("user", "name email")
      .populate("replies.user", "name email")
      .sort({ createdAt: -1 });

    // Ensure upvotedBy is an array and user data exists for all posts
    const postsWithDefaults = posts.map((post) => {
      const postObj = post.toObject();
      if (!postObj.upvotedBy) {
        postObj.upvotedBy = [];
      }
      // Ensure user data exists (filter out posts with deleted users)
      if (!postObj.user) {
        postObj.user = {
          _id: "unknown",
          name: "Deleted User",
          email: "unknown@example.com",
        };
      }
      return postObj;
    });

    res.json({ success: true, data: postsWithDefaults });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 👁️ Get single post
export const getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("user", "name email")
      .populate("replies.user", "name email");

    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    // Ensure upvotedBy is an array and user data exists
    const postObj = post.toObject();
    if (!postObj.upvotedBy) {
      postObj.upvotedBy = [];
    }
    // Ensure user data exists
    if (!postObj.user) {
      postObj.user = {
        _id: "unknown",
        name: "Deleted User",
        email: "unknown@example.com",
      };
    }

    res.json({ success: true, data: postObj });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 💬 Add reply
export const addReply = async (req, res) => {
  try {
    const { content } = req.body;

    if (!content?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Reply content is required" });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    const reply = { user: req.userId, content: content.trim() };
    post.replies.push(reply);
    await post.save();

    // Populate the latest reply with user info
    await post.populate("replies.user", "name email");
    const newReply = post.replies[post.replies.length - 1];

    // Convert to plain object for socket emission
    const replyData = newReply.toObject ? newReply.toObject() : newReply;
    
    // Ensure user data exists in reply
    if (!replyData.user) {
      // Fallback: get user from database if populate failed
      const User = (await import("../models/User.js")).default;
      const user = await User.findById(req.userId);
      if (user) {
        replyData.user = {
          _id: user._id,
          name: user.name,
          email: user.email,
        };
      } else {
        replyData.user = {
          _id: "unknown",
          name: "Unknown User",
          email: "unknown@example.com",
        };
      }
    }

    // Emit real-time event to post room (and also broadcast to all for simplicity)
    req.io?.emit("replyAdded", {
      postId: req.params.id,
      reply: replyData,
    });

    res.status(201).json({ success: true, data: replyData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ⬆️ Upvote post
export const upvotePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    // Optional: prevent duplicate upvotes
    if (!post.upvotedBy) post.upvotedBy = [];
    if (post.upvotedBy.includes(req.userId)) {
      return res
        .status(400)
        .json({ success: false, message: "You already upvoted this post" });
    }

    post.votes += 1;
    post.upvotedBy.push(req.userId);
    await post.save();

    // Emit updated vote count to all clients
    req.io?.emit("voteUpdated", {
      postId: req.params.id,
      votes: post.votes,
    });

    res.json({
      success: true,
      message: "Upvoted successfully",
      votes: post.votes,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
