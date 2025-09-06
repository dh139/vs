const express = require("express")
const User = require("../models/User")
const { authenticateToken, requireAdmin } = require("../middleware/auth")
const cloudinary = require("cloudinary").v2
const multer = require("multer")

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const storage = multer.memoryStorage()

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif/
  const extname = allowedTypes.test(file.originalname.toLowerCase())
  const mimetype = file.mimetype.startsWith("image/")

  if (mimetype && extname) {
    return cb(null, true)
  } else {
    cb(null, false)
  }
}

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter,
})

const router = express.Router()

router.put("/profile", authenticateToken, async (req, res) => {
  try {
    const { username, email, phone, sabhasadNo } = req.body
    const userId = req.user._id

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    // Update fields if provided
    if (username) user.username = username
    if (email) user.email = email
    if (phone) user.phone = phone
    if (sabhasadNo) user.sabhasadNo = sabhasadNo

    await user.save()

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        sabhasadNo: user.sabhasadNo,
        role: user.role,
        profilePhoto: user.profilePicture,
        createdAt: user.createdAt,
      },
    })
  } catch (error) {
    console.error("Update profile error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
})

router.post("/profile/photo", authenticateToken, upload.single("profilePhoto"), async (req, res) => {
  try {
    const userId = req.user._id

    console.log("[v0] Starting profile photo upload for user:", userId)

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      })
    }

    console.log("[v0] File received:", req.file.originalname, "Size:", req.file.size)

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    console.log("[v0] Current profilePicture:", user.profilePicture)

    if (user.profilePicture) {
      try {
        // Extract public_id from the URL
        const publicId = user.profilePicture.split("/").pop().split(".")[0]
        console.log("[v0] Deleting old image with publicId:", publicId)
        await cloudinary.uploader.destroy(`profiles/${publicId}`)
      } catch (error) {
        console.log("Error deleting old image:", error)
      }
    }

    console.log("[v0] Uploading to Cloudinary...")
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            resource_type: "image",
            folder: "profiles",
            transformation: [{ width: 400, height: 400, crop: "fill" }, { quality: "auto" }, { format: "auto" }],
          },
          (error, result) => {
            if (error) {
              console.log("[v0] Cloudinary upload error:", error)
              reject(error)
            } else {
              console.log("[v0] Cloudinary upload success:", result.secure_url)
              resolve(result)
            }
          },
        )
        .end(req.file.buffer)
    })

    user.profilePicture = uploadResult.secure_url
    await user.save()

    console.log("[v0] Updated user profilePicture in DB:", user.profilePicture)

    res.json({
      success: true,
      message: "Profile photo updated successfully",
      profilePhoto: user.profilePicture,
      profilePhotoUrl: user.profilePicture,
    })
  } catch (error) {
    console.error("Update profile photo error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
})

// Get all users (Admin only)
router.get("/", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select("-password -otp -otpExpires")

    res.json({
      success: true,
      users,
    })
  } catch (error) {
    console.error("Get users error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
})

router.patch("/:id/block", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params

    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    if (user.role === "admin") {
      return res.status(400).json({
        success: false,
        message: "Cannot block admin users",
      })
    }

    user.isBlocked = !user.isBlocked
    await user.save()

    res.json({
      success: true,
      message: `User ${user.isBlocked ? "blocked" : "unblocked"} successfully`,
      user: {
        id: user._id,
        username: user.username,
        isBlocked: user.isBlocked,
      },
    })
  } catch (error) {
    console.error("Toggle user block error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
})

router.put("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { username, email, phone, sabhasadNo, role } = req.body

    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    // Update fields if provided
    if (username) user.username = username
    if (email) user.email = email
    if (phone) user.phone = phone
    if (sabhasadNo) user.sabhasadNo = sabhasadNo
    if (role && ["user", "admin"].includes(role)) user.role = role

    await user.save()

    res.json({
      success: true,
      message: "User updated successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        sabhasadNo: user.sabhasadNo,
        role: user.role,
      },
    })
  } catch (error) {
    console.error("Update user error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
})

router.delete("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params

    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    if (user.role === "admin") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete admin users",
      })
    }

    await User.findByIdAndDelete(id)

    res.json({
      success: true,
      message: "User deleted successfully",
    })
  } catch (error) {
    console.error("Delete user error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
})

module.exports = router
