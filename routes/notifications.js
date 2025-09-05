const express = require("express")
const router = express.Router()
const { authenticate } = require("../middleware/auth")

// Send manual notification (Admin only)
router.post("/send", authenticate, async (req, res) => {
  try {
    const { title, message } = req.body

    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can send notifications",
      })
    }

    // Send notification to all users via socket
    const io = req.app.get("io")
    io.emit("manual_notification", {
      title,
      message,
      timestamp: new Date(),
    })

    res.json({
      success: true,
      message: "Notification sent successfully",
    })
  } catch (error) {
    console.error("Send notification error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to send notification",
      error: error.message,
    })
  }
})

module.exports = router
