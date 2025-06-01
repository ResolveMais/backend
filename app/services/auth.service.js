const userRepository = require("../repositories/user.repository");
const bcrypt = require('bcrypt');
const jwt = require("../utils/jwt");

exports.login = ({ email, password }) => {
    try {
        const user = userRepository.getByEmail(email);

        if (!user) return { status: 400, message: "Invalid credentials" };

        // check password with bcrypt
        const isPasswordValid = bcrypt.compare(password, user.password);

        if (!isPasswordValid) return { status: 400, message: "Invalid credentials" };

        // generate token
        const token = jwt.sign(user);

        return { status: 200, message: "Login successful", user: { id: user.id }, token };
    } catch (error) {
        console.error('Error during login: ' + error.message);
        throw new Error('Login failed');
    }
};