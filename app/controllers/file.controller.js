const FileStorageService = require('../services/fileStorage.service');
const logger = require('../utils/logger');

exports.upload = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Nenhum arquivo enviado' });
        }

        const fileName = await FileStorageService.saveFile(
            req.file, 
            req.params.ticketId
        );

        res.status(201).json({ 
            message: 'arquivo enviado com sucesso',
            fileName
        });
    } catch (error) {
        logger.error(`falha no upload do arquivo: ${error.message}`);
        res.status(500).json({ message: 'File upload failed' });
    }
};

exports.download = async (req, res) => {
    try {
        const filePath = FileStorageService.getFilePath(req.params.filename);
        res.download(filePath);
    } catch (error) {
        logger.error(`falha ao baixar o arquivo: ${error.message}`);
        res.status(404).json({ message: 'arquivo nao encontrado' });
    }
};