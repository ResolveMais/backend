const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { user: User } = require('../models');

class AuthService {
    static async login(email, password) {
        const user = await User.findOne({ where: { email } });
        
        if (!user) {
            throw new Error('Usuario nao encontrado');
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new Error('Credenciais Invalidas');
        }

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        return {
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                departmentId: user.departmentId
            }
        };
    }

    static async validateToken(token) {
        return jwt.verify(token, process.env.JWT_SECRET);
    }
}

module.exports = AuthService;