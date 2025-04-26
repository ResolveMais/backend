module.exports = (sequelize, Sequelize) => {
    const Department = sequelize.define(`department`, {
        id: {
            type: Sequelize.INTERGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true
        },
        description: {
            type: Sequelize.TEXT
        }
    });

    Department.associate = (models) => {
        Department.hasMany(models.user);
        Department.hasMany(models.ticket);
    };

    return Department;
};