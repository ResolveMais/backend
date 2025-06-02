const authService = require('../services/auth.service');

exports.login = async (req, res) => {
  const { email, password } = req.body;

  const response = await authService.login({ email, password });

  return res.status(response.status).json({ ...response });
};

exports.register = async (req, res) => {
  const { name, email, password, cpf, phone, birthDate } = req.body;

  const response = await authService.register({ name, email, password, cpf, phone, birthDate });

  return res.status(response.status).json({ ...response });
};

exports.validateToken = async (req, res) => {
  const { user } = req;

  if (!user || !user?.id) return res.status(401).json({ error: 'User not found' });

  return res.status(200).json({ status: 200, message: "Valid token", user });
}