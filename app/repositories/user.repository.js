const { User: UserModel } = require('../models');

module.exports = {
    create: async ({ name, email, password, cpf, phone, birthDate }) => {
        try {
            const newUser = await UserModel.create(
                {
                    name,
                    email,
                    password,
                    cpf,
                    phone,
                    birthDate,
                },
                {
                    attributes: ['id', 'name', 'email', 'cpf', 'phone', 'birthDate'],
                }
            );

            return newUser;
        } catch (error) {
            console.error('Error creating user: ' + error);
            throw error;
        }
    },
    getById: async (id) => {
        try {
            const user = await UserModel.findByPk(id, {
                attributes: ['id', 'name', 'email', 'cpf', 'phone', 'birthDate'],
            });

            if (!user) return null;

            return user;
        } catch (error) {
            console.error('Error fetching user by ID: ' + error.message);
            throw error;
        }
    },
    getByEmail: async (email, pass = false) => {
        try {
            const attributes = ['id', 'name', 'email', 'cpf', 'phone', 'birthDate'];
            if (pass) attributes.push('password');

            const user = await UserModel.findOne({ where: { email }, attributes });

            if (!user) return null;

            return user;
        } catch (error) {
            console.error('Error fetching user by email: ' + error.message);
            throw error; // Re-throw the error for further handling
        }
    },
};