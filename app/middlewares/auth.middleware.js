const userRepository = require('../repositories/user.repository');
const jwt = require('../utils/jwt');

const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    console.log({ headers: req.headers });

    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const cleanToken = authHeader.replace('Bearer ', '');

    if (!cleanToken) return res.status(401).json({ error: 'Token malformed' });

    try {
        const decoded = jwt.verify(cleanToken);

        if (!decoded) return res.status(401).json({ error: 'Token is invalid or expired' });

        if (decoded?.id) {
            const user = await userRepository.getById(decoded.id);

            if (!user) return res.status(401).json({ error: 'User not found' });
            req.user = user;
        }

        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token is invalid or expired' });
    }
};

module.exports = authMiddleware;