module.exports = (sequelize, Sequelize) => {
	const Company = sequelize.define('company', {
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
		freezeTableName: true,
	});

	return Company;
};
