const jwt = require("jsonwebtoken");

module.exports = {
    sign: (user) => {
        const token = jwt.sign({ id: user.id, email: user.email }, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: process.env.JWT_EXPIRATION,
            algorithm: process.env.JWT_ALGORITHM,
        });
    
        return token;
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