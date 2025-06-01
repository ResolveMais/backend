const { user: UserModel } = require('../models');

module.exports = {
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