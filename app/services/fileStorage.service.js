const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class FileStorageService {
    static uploadDir = path.join(__dirname, '../../uploads');

    static async saveFile(file, ticketId) {
        try {
            if (!fs.existsSync(this.uploadDir)) {
                fs.mkdirSync(this.uploadDir, { recursive: true });
            }

            const fileExt = path.extname(file.originalname);
            const fileName = `ticket_${ticketId}_${Date.now()}${fileExt}`;
            const filePath = path.join(this.uploadDir, fileName);

            await fs.promises.writeFile(filePath, file.buffer);
            return fileName;
        } catch (error) {
            logger.error(`erro no upload do arquivo: ${error.message}`);
            throw new Error('falha ao salvar o arquivo');
        }
    }

    static getFilePath(filename) {
        return path.join(this.uploadDir, filename);
    }
}

module.exports = FileStorageService;