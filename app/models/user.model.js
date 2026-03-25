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
        userType: {
            type: Sequelize.STRING(20),
            allowNull: false,
            defaultValue: 'cliente',
            field: 'user_type',
            validate: {
                isIn: [['cliente', 'funcionario', 'empresa']],
            },
        },
        phone: {
            type: Sequelize.STRING(20),
        },
        cpf: {
            type: Sequelize.STRING(14),
            allowNull: true,
        },
        cnpj: {
            type: Sequelize.STRING(18),
            allowNull: true,
        },
        avatarUrl: {
            type: Sequelize.STRING(500),
            allowNull: true,
            field: "avatar_url",
        },
        jobTitle: {
            type: Sequelize.STRING(120),
            allowNull: true,
            field: "job_title",
        },
        companyId: {
            type: Sequelize.INTEGER,
            allowNull: true,
            field: "company_id",
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

    User.associate = (models) => {
        User.hasMany(models.CompanyAdmin, {
            foreignKey: "user_id",
            as: "companyAdminLinks",
        });

        User.hasMany(models.PasswordResetToken, {
            foreignKey: "user_id",
            as: "passwordResetTokens",
        });

        User.belongsToMany(models.Company, {
            through: models.CompanyAdmin,
            foreignKey: "user_id",
            otherKey: "company_id",
            as: "adminCompanies",
        });

        User.belongsTo(models.Company, {
            foreignKey: "company_id",
            as: "company",
        });
    };

	return User;
};
