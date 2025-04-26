const express = require('express');
const router = express.Router();
const multer = require('multer');
const FileController = require('../controllers/file.controller');
const authMiddleware = require('../middlewares/auth');

const upload = multer({ storage: multer.memoryStorage() });

router.post(
    '/ticket/:ticketId/upload',
    authMiddleware,
    upload.single('file'),
    FileController.upload
);

router.get(
    '/download/:filename',
    authMiddleware,
    FileController.download
);

module.exports = { alias: "/files", router };