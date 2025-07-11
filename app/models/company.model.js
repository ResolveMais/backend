module.exports = (sequelize, Sequelize) => {
	const Company = sequelize.define('Company', {
		id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		name: {
			type: Sequelize.STRING,
			allowNull: false,
			unique: true,
		},
        description: {
            type: Sequelize.STRING,
        },
        cnpj: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true,
        },
	}, {
		tableName: "Company",
		timestamps: false,
	});

	return Company;
};
