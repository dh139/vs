const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const http = require("http")
const socketIo = require("socket.io")
require("dotenv").config()

const authRoutes = require("./routes/auth")
const postRoutes = require("./routes/posts")
const userRoutes = require("./routes/users")
const eventRoutes = require("./routes/events")
const notificationRoutes = require("./routes/notifications")
const { authenticateSocket } = require("./middleware/auth")

const app = express()
const server = http.createServer(app)
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
})

// Middleware
app.use(cors())
app.use(express.json())
app.use("/uploads", express.static("uploads"))

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/posts", postRoutes)
app.use("/api/users", userRoutes)
app.use("/api/events", eventRoutes)
app.use("/api/notifications", notificationRoutes)

// Socket.io connection handling
io.use(authenticateSocket)

io.on("connection", (socket) => {
  console.log("User connected:", socket.userId)

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.userId)
  })
})

// Make io accessible to routes
app.set("io", io)

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/samaj-app")
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err))

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
