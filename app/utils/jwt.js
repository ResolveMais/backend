const jwt = require("jsonwebtoken");

module.exports = {
    sign: (user) => {
        const token = jwt.sign({ id: user?.id, email: user?.email }, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: process.env.JWT_EXPIRATION,
            algorithm: process.env.JWT_ALGORITHM,
        });
    
        return token;
    },
    verify: (token) => {
        const cleanToken = token.replace("Bearer ", "");
        try {
            const decoded = jwt.verify(cleanToken, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: process.env.JWT_EXPIRATION,
                algorithm: process.env.JWT_ALGORITHM,
            });
            return decoded;
        } catch (error) {
            throw new Error("Token is invalid or expired");
        }
    },
    decode: (token) => {
        const cleanToken = token.replace("Bearer ", "");
        const decoded = jwt.decode(cleanToken, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: process.env.JWT_EXPIRATION,
            algorithm: process.env.JWT_ALGORITHM,
        });

        return decoded;
    }
}