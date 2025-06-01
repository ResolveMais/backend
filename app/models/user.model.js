module.exports = (sequelize, Sequelize) => {
	const User = sequelize.define('User', {
		id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		name: {
			type: Sequelize.STRING,
			allowNull: false,
		},
        email: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true,
        },
        phone: {
            type: Sequelize.STRING(20),
        },
        cpf: {
            type: Sequelize.STRING(14),
            allowNull: false,
            unique: true,
        },
        password: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        birthDate: {
            type: Sequelize.DATE,
        },
	}, {
		tableName: "User",
		timestamps: false,
	});

	return User;
};
