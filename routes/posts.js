const express = require("express")
const cloudinary = require("cloudinary").v2
const multer = require("multer")
const { body, validationResult } = require("express-validator")
const Post = require("../models/Post")
const { authenticateToken, requireAdmin } = require("../middleware/auth")

const router = express.Router()

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const storage = multer.memoryStorage()

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const isImageMimeType = file.mimetype.startsWith("image/")
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"]
    const hasImageExtension = imageExtensions.some((ext) => file.originalname.toLowerCase().endsWith(ext))

    if (isImageMimeType || (file.mimetype === "application/octet-stream" && hasImageExtension)) {
      cb(null, true)
    } else {
      cb(null, false)
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
        image: post.image, // Return Cloudinary URL directly instead of constructing local URL
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
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation errors",
          errors: errors.array(),
        })
      }

      const { caption } = req.body
      let imageUrl = null

      if (req.file) {
        const uploadResult = await new Promise((resolve, reject) => {
          cloudinary.uploader
            .upload_stream(
              {
                resource_type: "image",
                folder: "posts",
                transformation: [{ width: 800, height: 600, crop: "limit" }, { quality: "auto" }, { format: "auto" }],
              },
              (error, result) => {
                if (error) reject(error)
                else resolve(result)
              },
            )
            .end(req.file.buffer)
        })
        imageUrl = uploadResult.secure_url
      }

      if (!req.file && req.body.image) {
        return res.status(400).json({
          success: false,
          message: "Only image files are allowed",
        })
      }

      const post = new Post({
        caption,
        image: imageUrl, // Store Cloudinary URL instead of filename
        createdBy: req.user._id,
      })

      await post.save()

      // Emit notification to all connected users
      const io = req.app.get("io")
      io.emit("new_post", {
        message: "A new post has been published!",
        postId: post._id,
      })

      res.status(201).json({
        success: true,
        message: "Post created successfully",
        post: {
          _id: post._id,
          caption: post.caption,
          image: post.image, // Return Cloudinary URL directly
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

    const post = await Post.findById(id)
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      })
    }

    if (post.image) {
      try {
        // Extract public_id from the URL
        const publicId = post.image.split("/").pop().split(".")[0]
        await cloudinary.uploader.destroy(`posts/${publicId}`)
      } catch (error) {
        console.log("Error deleting image from Cloudinary:", error)
      }
    }

    await Post.findByIdAndDelete(id)

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
