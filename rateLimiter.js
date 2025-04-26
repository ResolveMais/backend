const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Limite de 100 requisições por IP
    message: 'Too many requests from this IP, please try again later'
});

const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 5, // Limite de 5 tentativas de login
    message: 'Too many login attempts, please try again later'
});

module.exports = {
    apiLimiter,
    authLimiter
};