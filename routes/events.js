const express = require("express")
const router = express.Router()
const Event = require("../models/Event")
const { authenticate } = require("../middleware/auth")

// Create a new event (Admin only)
router.post("/", authenticate, async (req, res) => {
  try {
    const { title, description, dateTime } = req.body

    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can create events",
      })
    }

    const event = new Event({
      title,
      description,
      dateTime: new Date(dateTime),
      createdBy: req.user.id,
    })

    await event.save()

    // Populate creator info
    await event.populate("createdBy", "username email")

    // Send notification to all users via socket
    const io = req.app.get("io")
    io.emit("new_event", {
      event: event,
      message: `New event: ${title}`,
    })

    res.status(201).json({
      success: true,
      message: "Event created successfully",
      event,
    })
  } catch (error) {
    console.error("Create event error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to create event",
      error: error.message,
    })
  }
})

// Get all events
router.get("/", authenticate, async (req, res) => {
  try {
    const events = await Event.find({ isActive: true }).populate("createdBy", "username email").sort({ dateTime: 1 })

    res.json({
      success: true,
      events,
    })
  } catch (error) {
    console.error("Get events error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch events",
      error: error.message,
    })
  }
})

// Get single event
router.get("/:id", authenticate, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate("createdBy", "username email")
      .populate("attendees", "username email")

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      })
    }

    res.json({
      success: true,
      event,
    })
  } catch (error) {
    console.error("Get event error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch event",
      error: error.message,
    })
  }
})

// Update event (Admin only)
router.put("/:id", authenticate, async (req, res) => {
  try {
    const { title, description, dateTime } = req.body

    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can update events",
      })
    }

    const event = await Event.findByIdAndUpdate(
      req.params.id,
      {
        title,
        description,
        dateTime: new Date(dateTime),
      },
      { new: true },
    ).populate("createdBy", "username email")

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      })
    }

    res.json({
      success: true,
      message: "Event updated successfully",
      event,
    })
  } catch (error) {
    console.error("Update event error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to update event",
      error: error.message,
    })
  }
})

// Delete event (Admin only)
router.delete("/:id", authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can delete events",
      })
    }

    const event = await Event.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true })

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      })
    }

    res.json({
      success: true,
      message: "Event deleted successfully",
    })
  } catch (error) {
    console.error("Delete event error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to delete event",
      error: error.message,
    })
  }
})

// Send event notification (Admin only)
router.post("/:id/notify", authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can send notifications",
      })
    }

    const event = await Event.findById(req.params.id)

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      })
    }

    // Send notification to all users via socket
    const io = req.app.get("io")
    io.emit("event_reminder", {
      event: event,
      message: `Reminder: ${event.title} is coming up!`,
    })

    // Mark notification as sent
    event.notificationSent = true
    await event.save()

    res.json({
      success: true,
      message: "Event notification sent successfully",
    })
  } catch (error) {
    console.error("Send event notification error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to send event notification",
      error: error.message,
    })
  }
})

// Join event
router.post("/:id/join", authenticate, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      })
    }

    // Check if user already joined
    if (event.attendees.includes(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: "You have already joined this event",
      })
    }

    event.attendees.push(req.user.id)
    await event.save()

    res.json({
      success: true,
      message: "Successfully joined the event",
    })
  } catch (error) {
    console.error("Join event error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to join event",
      error: error.message,
    })
  }
})

module.exports = router
