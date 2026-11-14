const nodemailer = require('nodemailer');

let transporter = null;

if (process.env.SMTP_HOST && process.env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

const sendEmail = async ({ to, subject, html, text }) => {
  if (!transporter) {
    console.log(`[Email Simulation] To: ${to} | Subject: "${subject}" | Content: ${text || html}`);
    return { success: true, simulated: true };
  }
  try {
    const info = await transporter.sendMail({
      from: `"Library Management System" <${process.env.SMTP_FROM || 'no-reply@library.edu'}>`,
      to,
      subject,
      text,
      html
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[Email Error] Failed to send email to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendEmail };
