const { user: UserModel } = require('../models');

module.exports = {
    create: async ({ name, email, password, cpf, phone, birthDate }) => {
        try {
            const newUser = await UserModel.create({
                name,
                email,
                password,
                cpf,
                phone,
                birthDate,
            });

            return newUser;
        } catch (error) {
            console.error('Error creating user: ' + error.message);
            throw error;
        }
    },
    getByEmail: async (email) => {
        try {
            const user = await UserModel.findOne({ where: { email } });

            if (!user) {
                return null;
            }

            return user;
        } catch (error) {
            console.error('Error fetching user by email: ' + error.message);
            throw error; // Re-throw the error for further handling
        }
    },
};