import { PasswordResetToken as PasswordResetTokenModel } from "../models/index.js";

const create = async ({ userId, tokenHash, expiresAt }, options = {}) =>
  PasswordResetTokenModel.create(
    {
      userId,
      tokenHash,
      expiresAt,
      createdAt: new Date(),
    },
    options
  );

const markAllAsUsedByUserId = async (userId, options = {}) =>
  PasswordResetTokenModel.update(
    { usedAt: new Date() },
    {
      where: {
        userId,
        usedAt: null,
      },
      ...options,
    }
  );

const getActiveByTokenHash = async (tokenHash, options = {}) =>
  PasswordResetTokenModel.findOne({
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

export { create, getActiveByTokenHash, markAllAsUsedByUserId };

export default {
  create,
  markAllAsUsedByUserId,
  getActiveByTokenHash,
};
