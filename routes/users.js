const express = require("express")
const User = require("../models/User")
const { authenticateToken, requireAdmin } = require("../middleware/auth")
const multer = require("multer")
const path = require("path")
const fs = require("fs")

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/profiles"
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, "profile-" + uniqueSuffix + path.extname(file.originalname))
  },
})

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif/
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
  const mimetype = file.mimetype.startsWith("image/") || file.mimetype === "application/octet-stream"

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

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    // Delete old profile photo if exists
    if (user.profilePicture) {
      const oldPhotoPath = path.join(__dirname, "..", user.profilePicture)
      if (fs.existsSync(oldPhotoPath)) {
        fs.unlinkSync(oldPhotoPath)
      }
    }

    // Update user with new profile photo path
    const newProfilePhotoPath = `uploads/profiles/${req.file.filename}`
    user.profilePicture = newProfilePhotoPath
    await user.save()

    res.json({
      success: true,
      message: "Profile photo updated successfully",
      profilePhoto: user.profilePicture,
      profilePhotoUrl: `${req.protocol}://${req.get("host")}/${user.profilePicture}`,
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
