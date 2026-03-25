const authService = require('../services/auth.service');

exports.login = async (req, res) => {
  const { email, password } = req.body;

  const response = await authService.login({ email, password });

  return res.status(response.status).json({ ...response });
};

exports.register = async (req, res) => {
  const {
    name,
    email,
    password,
    userType,
    cpf,
    cnpj,
    documentNumber,
    phone,
    birthDate,
    companyName,
    companyDescription,
    companyCnpj,
    adminUser,
  } = req.body;

  const response = await authService.register({
    name,
    email,
    password,
    userType,
    cpf,
    cnpj,
    documentNumber,
    phone,
    birthDate,
    companyName,
    companyDescription,
    companyCnpj,
    adminUser,
  });

  return res.status(response.status).json({ ...response });
};

exports.validateToken = async (req, res) => {
  const { user } = req;

  if (!user || !user?.id) return res.status(401).json({ error: 'User not found' });

  return res.status(200).json({ status: 200, message: "Valid token", user });
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body || {};
  const response = await authService.forgotPassword({ email });
  return res.status(response.status).json({ ...response });
};

exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body || {};
  const response = await authService.resetPassword({ token, newPassword });
  return res.status(response.status).json({ ...response });
};

exports.validateResetToken = async (req, res) => {
  const { token } = req.body || {};
  const response = await authService.validateResetToken({ token });
  return res.status(response.status).json({ ...response });
};
