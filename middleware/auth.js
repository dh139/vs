const jwt = require("jsonwebtoken")
const User = require("../models/User")

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"]
    const token = authHeader && authHeader.split(" ")[1]

    if (!token) {
      return res.status(401).json({ success: false, message: "Access token required" })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key")
    const user = await User.findById(decoded.userId).select("-password")

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid token" })
    }

    if (user.isBlocked) {
      return res.status(403).json({ success: false, message: "Account is blocked" })
    }

    req.user = user
    next()
  } catch (error) {
    return res.status(403).json({ success: false, message: "Invalid token" })
  }
}

const requireAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Admin access required" })
  }
  next()
}

const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key")
    const user = await User.findById(decoded.userId).select("-password")

    if (!user || user.isBlocked) {
      return next(new Error("Authentication error"))
    }

    socket.userId = user._id
    socket.user = user
    next()
  } catch (error) {
    next(new Error("Authentication error"))
  }
}

const authenticate = authenticateToken

module.exports = {
  authenticate,
  authenticateToken,
  requireAdmin,
  authenticateSocket,
}
