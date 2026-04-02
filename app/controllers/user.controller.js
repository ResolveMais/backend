import userRepository from "../repositories/user.repository.js";

const updateProfile = async (req, res) => {
  const userId = req.user.id;
  const { name, email, phone, avatarUrl, jobTitle } = req.body || {};

  try {
    if (req.body?.cpf !== undefined || req.body?.cnpj !== undefined) {
      return res.status(400).json({ error: "CPF/CNPJ cannot be updated after registration" });
    }

    const payload = {};
    if (name !== undefined) payload.name = String(name).trim();
    if (phone !== undefined) payload.phone = String(phone).trim();
    if (avatarUrl !== undefined) payload.avatarUrl = avatarUrl ? String(avatarUrl).trim() : null;
    if (jobTitle !== undefined) payload.jobTitle = jobTitle ? String(jobTitle).trim() : null;

    if (email !== undefined) {
      const normalizedEmail = String(email).trim();
      const existingEmailUser = await userRepository.getByEmail(normalizedEmail);

      if (existingEmailUser && Number(existingEmailUser.id) !== Number(userId)) {
        return res.status(400).json({ error: "E-mail already registered" });
      }

      payload.email = normalizedEmail;
    }

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ error: "No profile fields provided for update" });
    }

    const updated = await userRepository.update(userId, payload);

    if (!updated) {
      const currentUser = await userRepository.getById(userId);
      if (!currentUser) return res.status(404).json({ error: "User not found" });

      return res.status(200).json({ message: "No profile changes detected", user: currentUser });
    }

    const user = await userRepository.getById(userId);
    return res.status(200).json({ message: "Profile updated successfully", user });
  } catch (error) {
    console.error("Error updating profile: " + error);
    return res.status(500).json({ error: "An error occurred while updating the profile" });
  }
};

export { updateProfile };

export default {
  updateProfile,
};
