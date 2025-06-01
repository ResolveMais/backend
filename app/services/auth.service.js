const userRepository = require("../repositories/user.repository");
const bcrypt = require('bcrypt');
const jwt = require("../utils/jwt");

exports.login = async ({ email, password }) => {
    try {
        const user = await userRepository.getByEmail(email);

        if (!user) return { status: 400, message: "Invalid credentials" };

        // check password with bcrypt
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) return { status: 400, message: "Invalid credentials" };

        // generate token
        const token = jwt.sign(user);

        return {
            status: 200,
            message: "Login successful",
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                cpf: user.cpf,
                phone: user.phone,
                birthDate: user.birthDate,
            },
            token
        };
    } catch (error) {
        console.error('Error during login: ' + error.message);
        return { status: 500, message: "Login failed" };
    }
};

exports.register = async ({ name, email, password, cpf, phone = null, birthDate = null }) => {
    try {
        if (!name || !email || !password || !cpf) {
            return { status: 400, message: 'Name, email, and password are required' };
        }

        // Check if user already exists
        const existingUser = await userRepository.getByEmail(email);
        if (existingUser) {
            return { status: 400, message: 'User already exists' };
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const newUser = await userRepository.create({ name, email, password: hashedPassword, cpf, phone, birthDate });

        if (!newUser || !newUser.id) {
            return { status: 500, message: 'User registration failed' };
        }

        // Generate token for the new user
        const token = jwt.sign(newUser);

        return { status: 201, message: 'User registered successfully', user: { id: newUser.id }, token };
    } catch (error) {
        console.error('Error during registration: ' + error.message);
        return { status: 500, message: 'Registration failed' };
    }
}