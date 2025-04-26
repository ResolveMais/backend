require('dotenv').config();
const { sequelize } = require('../../app/models');
const initialData = require('./initialData');

(async () => {
    try {
        await sequelize.sync({ force: true });
        await initialData();
        process.exit(0);
    } catch (error) {
        console.error('erro ao execuratar seeders:', error);
        process.exit(1);
    }
})();require('dotenv').config();
const { sequelize } = require('../../app/models');
const initialData = require('./initialData');

(async () => {
    try {
        console.log('Starting database seeding...');
        
        // Sincronizar modelos com o banco de dados
        await sequelize.sync({ force: process.env.NODE_ENV !== 'production' });
        
        // Executar seeders
        await initialData();
        
        console.log('Database seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error during seeding:', error);
        process.exit(1);
    }
})();