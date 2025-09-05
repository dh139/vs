const mongoose = require("mongoose")
const User = require("../models/User")
require("dotenv").config()

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/samaj-app")

    const adminUser = new User({
      username: "admin",
      email: "admin@samaj.com",
      phone: "+1234567890",
      password: "admin123",
      sabhasadNo: "ADMIN001",
      role: "admin",
      isActive: true,
    })

    await adminUser.save()
    console.log("Admin user created successfully")

    mongoose.disconnect()
  } catch (error) {
    console.error("Error creating admin user:", error)
    mongoose.disconnect()
  }
}

createAdmin()
