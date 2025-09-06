const express = require("express")
const jwt = require("jsonwebtoken")
const { body, validationResult } = require("express-validator")
const User = require("../models/User")
const { sendOtpEmail } = require("../utils/email")
const { generateOtp } = require("../utils/helpers")
const { authenticateToken } = require("../middleware/auth")

const router = express.Router()

// Register user
router.post(
  "/register",
  [
    body("username").trim().isLength({ min: 3 }).withMessage("Username must be at least 3 characters"),
    body("email").isEmail().withMessage("Please provide a valid email"),
    body("phone").isMobilePhone().withMessage("Please provide a valid phone number"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    body("sabhasadNo").trim().notEmpty().withMessage("Sabhasad No. is required"),
  ],
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

      const { username, email, phone, password, sabhasadNo } = req.body

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email }, { phone }, { username }, { sabhasadNo }],
      })

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User with this email, phone, username, or sabhasad number already exists",
        })
      }

      // Generate OTP
      const otp = generateOtp()
      const otpExpires = new Date(Date.now() + 2 * 60 * 1000) // 2 minutes

      // Create user (inactive)
      const user = new User({
        username,
        email,
        phone,
        password,
        sabhasadNo,
        otp,
        otpExpires,
        isActive: false,
      })

      await user.save()

      // Send OTP email
      await sendOtpEmail(email, otp)

      res.status(201).json({
        success: true,
        message: "Registration successful. Please check your email for OTP verification.",
      })
    } catch (error) {
      console.error("Registration error:", error)
      res.status(500).json({
        success: false,
        message: "Internal server error",
      })
    }
  },
)

// Resend OTP
router.post(
  "/resend-otp",
  [
    body("email").isEmail().withMessage("Please provide a valid email"),
  ],
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

      const { email } = req.body

      const user = await User.findOne({ email })
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        })
      }

      if (user.isActive) {
        return res.status(400).json({
          success: false,
          message: "User is already verified",
        })
      }

      // Generate new OTP
      const otp = generateOtp()
      const otpExpires = new Date(Date.now() + 2 * 60 * 1000) // 2 minutes

      // Update user with new OTP
      user.otp = otp
      user.otpExpires = otpExpires
      await user.save()

      // Send OTP email
      await sendOtpEmail(email, otp)

      res.json({
        success: true,
        message: "New OTP sent successfully",
      })
    } catch (error) {
      console.error("Resend OTP error:", error)
      res.status(500).json({
        success: false,
        message: "Internal server error",
      })
    }
  },
)

// Verify OTP
router.post(
  "/verify-otp",
  [
    body("email").isEmail().withMessage("Please provide a valid email"),
    body("otp").isLength({ min: 6, max: 6 }).withMessage("OTP must be 6 digits"),
  ],
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

      const { email, otp } = req.body

      const user = await User.findOne({ email })
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        })
      }

      if (user.otp !== otp || user.otpExpires < new Date()) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired OTP",
        })
      }

      // Activate user
      user.isActive = true
      user.otp = null
      user.otpExpires = null
      await user.save()

      // Generate JWT token
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || "your-secret-key", { expiresIn: "7d" })

      res.json({
        success: true,
        message: "OTP verified successfully",
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      })
    } catch (error) {
      console.error("OTP verification error:", error)
      res.status(500).json({
        success: false,
        message: "Internal server error",
      })
    }
  },
)

// Login
router.post(
  "/login",
  [
    body("identifier").notEmpty().withMessage("Email or phone is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
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

      const { identifier, password } = req.body

      // Find user by email or phone
      const user = await User.findOne({
        $or: [{ email: identifier }, { phone: identifier }],
      })

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        })
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: "Account not activated. Please verify your email.",
        })
      }

      if (user.isBlocked) {
        return res.status(401).json({
          success: false,
          message: "Account is blocked. Please contact administrator.",
        })
      }

      const isPasswordValid = await user.comparePassword(password)
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        })
      }

      // Generate JWT token
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || "your-secret-key", { expiresIn: "7d" })

      res.json({
        success: true,
        message: "Login successful",
        token,
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
      console.error("Login error:", error)
      res.status(500).json({
        success: false,
        message: "Internal server error",
      })
    }
  },
)

// Get current user profile
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    console.log("[v0] Profile endpoint called")
    console.log("[v0] User ID from token:", req.user._id)
    console.log("[v0] User from middleware:", JSON.stringify(req.user, null, 2))

    const user = await User.findById(req.user._id).select("-password -otp -otpExpires")

    if (!user) {
      console.log("[v0] User not found in database")
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    console.log("[v0] Profile endpoint - fetched user from DB:", JSON.stringify(user, null, 2))
    console.log("[v0] Profile endpoint - user profilePicture:", user.profilePicture)
    console.log("[v0] Profile endpoint - user profilePicture type:", typeof user.profilePicture)

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        sabhasadNo: user.sabhasadNo,
        role: user.role,
        isActive: user.isActive,
        isBlocked: user.isBlocked,
        createdAt: user.createdAt,
        profilePhoto: user.profilePicture,
      },
    })
  } catch (error) {
    console.error("Get profile error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
})

module.exports = router