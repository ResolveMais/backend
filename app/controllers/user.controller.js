const userRepository = require("../repositories/user.repository");

exports.updateProfile = async (req, res) => {
    const userId = req.user.id;
    const { name, email, cpf, cnpj, phone } = req.body;

    try {
        const payload = {};
        if (name !== undefined) payload.name = name;
        if (email !== undefined) payload.email = email;
        if (cpf !== undefined) payload.cpf = cpf;
        if (cnpj !== undefined) payload.cnpj = cnpj;
        if (phone !== undefined) payload.phone = phone;

        const updated = await userRepository.update(userId, payload);

        if (!updated) return res.status(404).json({ error: 'User not found or no changes made' });

        return res.status(200).json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Error updating profile: ' + error.message);
        return res.status(500).json({ error: 'An error occurred while updating the profile' });
    }
};
