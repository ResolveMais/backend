const authService = require('../services/auth.service');

exports.login = async (req, res) => {
  // Simulate a login process
  const { email, password } = req.body;

  const response = await authService.login({ email, password });

  return res.status(response.status).json({
    message: response.message,
    token: response.token,
    user: response.user,
  });
}