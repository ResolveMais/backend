module.exports = (err, req, res, next) => {
    console.error(err.stack);

    if (err.name === `validationError`) {
        return res.status(400).json({
            message: `Erro de validacao`,
            details: err.errors.map(e => e.message)
        });
    }
    res.status(500).json({
        message: `algo deu errado`,
        error: process.env.NODE_ENV === `development` ? err : {}
    });
};