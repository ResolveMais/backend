const nodemailer = require('nodemailer');
const { user: User } = require('../models');
const logger = require('../utils/logger');

class NotificationService {
    static transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    static async sendEmail(to, subject, text) {
        try {
            const mailOptions = {
                from: `SAC System <${process.env.EMAIL_USER}>`,
                to,
                subject,
                text
            };

            await this.transporter.sendMail(mailOptions);
        } catch (error) {
            logger.error(`Error sending email: ${error.message}`);
        }
    }
}

module.exports = NotificationService;