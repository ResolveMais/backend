const { PasswordResetToken: PasswordResetTokenModel } = require("../models");

module.exports = {
  create: async ({ userId, tokenHash, expiresAt }, options = {}) => {
    return PasswordResetTokenModel.create(
      {
        userId,
        tokenHash,
        expiresAt,
        createdAt: new Date(),
      },
      options
    );
  },

  markAllAsUsedByUserId: async (userId, options = {}) => {
    return PasswordResetTokenModel.update(
      { usedAt: new Date() },
      {
        where: {
          userId,
          usedAt: null,
        },
        ...options,
      }
    );
  },

  getActiveByTokenHash: async (tokenHash, options = {}) => {
    return PasswordResetTokenModel.findOne({
      where: {
        tokenHash,
        usedAt: null,
      },
      include: [
        {
          association: "user",
        },
      ],
      ...options,
    });
  },

};
