'use strict';

const nodemailer = require('nodemailer');

async function notifyByMail(subject, message) {
  if (
    !process.env.NOTIFY_EMAIL_USER ||
    !process.env.NOTIFY_EMAIL_PASS ||
    !process.env.NOTIFY_EMAIL_TO
  ) {
    return;
  }
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.NOTIFY_EMAIL_USER,
      pass: process.env.NOTIFY_EMAIL_PASS
    }
  });
  await transporter.sendMail({
    from: process.env.NOTIFY_EMAIL_USER,
    to: process.env.NOTIFY_EMAIL_TO,
    subject,
    text: message
  });
}

module.exports = { notifyByMail };