const userRepository = require("../repositories/user.repository");

exports.updateProfile = async (req, res) => {
    const userId = req.user.id;
    const { name, email, cpf, phone } = req.body;

    try {
        const updated = await userRepository.update(userId, { name, email, cpf, phone });

        if (updated === 0) return res.status(404).json({ error: 'User not found or no changes made' });

        return res.status(200).json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Error updating profile: ' + error.message);
        return res.status(500).json({ error: 'An error occurred while updating the profile' });
    }
};