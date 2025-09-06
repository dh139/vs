const nodemailer = require("nodemailer");

// Create transporter
const transporter = nodemailer.createTransport({
  service: "gmail", // or your email service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Function to send OTP email
const sendOtpEmail = async (email, otp) => {
  try {
    const mailOptions = {
      from: `"VS Samaj App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your OTP Verification - VS Samaj App",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 30px; border-radius: 12px; border: 1px solid #e0e0e0;">
          
          <h2 style="text-align: center; color: #000; margin-bottom: 10px;">VS Samaj App</h2>
          <p style="text-align: center; color: #555; margin: 0 0 30px;">OTP Verification</p>
          
          <p style="font-size: 15px; color: #333;">Hello,</p>
          <p style="font-size: 15px; color: #333;">Thank you for registering with <b>VS Samaj App</b>. Please use the following OTP to verify your email address:</p>
          
          <div style="background-color: #000; color: #fff; padding: 20px; text-align: center; margin: 25px 0; border-radius: 8px;">
            <h1 style="font-size: 34px; letter-spacing: 8px; margin: 0;">${otp}</h1>
          </div>
          
          <p style="font-size: 14px; color: #555;">⚠️ This OTP will expire in <b>2 minutes</b>.</p>
          <p style="font-size: 14px; color: #555;">If you didn’t request this verification, please ignore this email.</p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          
          <p style="font-size: 13px; color: #888; text-align: center;">© ${new Date().getFullYear()} VS Samaj App. All rights reserved.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log("OTP email sent successfully to:", email);
  } catch (error) {
    console.error("Error sending OTP email:", error);
    throw error;
  }
};

module.exports = {
  sendOtpEmail,
};