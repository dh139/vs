const express = require("express")
const multer = require("multer")
const path = require("path")
const fs = require("fs") // Added fs module to create uploads directory
const { body, validationResult } = require("express-validator")
const Post = require("../models/Post")
const { authenticateToken, requireAdmin } = require("../middleware/auth")

const router = express.Router()

const uploadsDir = "uploads"
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
  console.log("Created uploads directory")
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/")
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    const filename = file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    console.log("[v0] Saving file as:", filename) // Added debug logging
    cb(null, filename)
  },
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log("[v0] File received:", file.originalname, "Type:", file.mimetype) // Added debug logging

    const isImageMimeType = file.mimetype.startsWith("image/")
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"]
    const hasImageExtension = imageExtensions.some((ext) => file.originalname.toLowerCase().endsWith(ext))

    if (isImageMimeType || (file.mimetype === "application/octet-stream" && hasImageExtension)) {
      console.log("[v0] File accepted as image") // Added debug logging
      cb(null, true)
    } else {
      console.log("[v0] File rejected - not an image") // Added debug logging
      cb(null, false) // Reject file gracefully instead of throwing error
    }
  },
})

// Get all posts
router.get("/", authenticateToken, async (req, res) => {
  try {
    const posts = await Post.find().populate("createdBy", "username").sort({ createdAt: -1 })

    res.json({
      success: true,
      posts: posts.map((post) => ({
        _id: post._id,
        caption: post.caption,
        image: post.image ? `${req.protocol}://${req.get("host")}/uploads/${post.image}` : null,
        createdAt: post.createdAt,
        feedbacks: post.feedbacks,
      })),
    })
  } catch (error) {
    console.error("Get posts error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
})

// Create post (Admin only)
router.post(
  "/",
  authenticateToken,
  requireAdmin,
  upload.single("image"),
  [body("caption").trim().notEmpty().withMessage("Caption is required")],
  async (req, res) => {
    try {
      console.log("[v0] Create post request received") // Added debug logging
      console.log("[v0] Request file:", req.file) // Added debug logging
      console.log("[v0] Request body:", req.body) // Added debug logging

      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation errors",
          errors: errors.array(),
        })
      }

      const { caption } = req.body
      const image = req.file ? req.file.filename : null

      console.log("[v0] Image filename:", image) // Added debug logging

      if (!req.file && req.body.image) {
        return res.status(400).json({
          success: false,
          message: "Only image files are allowed",
        })
      }

      const post = new Post({
        caption,
        image,
        createdBy: req.user._id,
      })

      await post.save()
      console.log("[v0] Post saved to database:", post._id) // Added debug logging

      // Emit notification to all connected users
      const io = req.app.get("io")
      io.emit("new_post", {
        message: "A new post has been published!",
        postId: post._id,
      })

      const imageUrl = post.image ? `${req.protocol}://${req.get("host")}/uploads/${post.image}` : null
      console.log("[v0] Image URL:", imageUrl) // Added debug logging

      res.status(201).json({
        success: true,
        message: "Post created successfully",
        post: {
          _id: post._id,
          caption: post.caption,
          image: imageUrl,
          createdAt: post.createdAt,
        },
      })
    } catch (error) {
      console.error("Create post error:", error)
      res.status(500).json({
        success: false,
        message: "Internal server error",
      })
    }
  },
)

// Submit feedback
router.post(
  "/:id/feedback",
  authenticateToken,
  [body("message").trim().notEmpty().withMessage("Feedback message is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation errors",
          errors: errors.array(),
        })
      }

      const { id } = req.params
      const { message } = req.body

      const post = await Post.findById(id)
      if (!post) {
        return res.status(404).json({
          success: false,
          message: "Post not found",
        })
      }

      const feedback = {
        userId: req.user._id,
        username: req.user.username,
        message,
      }

      post.feedbacks.push(feedback)
      await post.save()

      res.json({
        success: true,
        message: "Feedback submitted successfully",
        feedback,
      })
    } catch (error) {
      console.error("Submit feedback error:", error)
      res.status(500).json({
        success: false,
        message: "Internal server error",
      })
    }
  },
)

// Delete post (Admin only)
router.delete("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params

    const post = await Post.findByIdAndDelete(id)
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      })
    }

    res.json({
      success: true,
      message: "Post deleted successfully",
    })
  } catch (error) {
    console.error("Delete post error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
})

module.exports = router
