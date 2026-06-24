const { connectToDatabase } = require('./config/db');
const { validateEnv } = require('./config/env');
const { disconnectFromDatabase } = require('./config/db');
const tenantModel = require('./models/tenant.model');
const logger = require('./utils/logger');

async function seed() {
    validateEnv({ requireMongo: true });
    await connectToDatabase();

    const samples = [
        {
            name: 'Kopi Ceria',
            description: 'Tenant kopi spesial dan makanan ringan pendamping',
            menu: [
                { name: 'Espresso', description: 'Double shot espresso', price: 15000, stock: 100 },
                { name: 'Cappuccino', description: 'Espresso + susu berbusa', price: 22000, stock: 100 },
                { name: 'Kopi Susu Gula Aren', description: 'Signature es kopi susu', price: 20000, stock: 100 },
                { name: 'Americano', description: 'Espresso + air mineral', price: 18000, stock: 100 },
                { name: 'Croissant Butter', description: 'Buttery classic croissant', price: 18000, stock: 100 },
            ],
        },
        {
            name: 'Ayam Geprek Mercon',
            description: 'Ayam geprek krispi dengan sambal super pedas',
            menu: [
                { name: 'Paket Geprek Level 1', description: 'Nasi + Ayam + Es Teh (Pedas Sedang)', price: 25000, stock: 100 },
                { name: 'Paket Geprek Level 5', description: 'Nasi + Ayam + Es Teh (Super Pedas)', price: 25000, stock: 100 },
                { name: 'Jamur Crispy', description: 'Jamur tiram goreng tepung', price: 12000, stock: 100 },
                { name: 'Kulit Ayam Goreng', description: 'Kulit ayam krispi gurih', price: 15000, stock: 100 },
                { name: 'Tahu Tempe Goreng', description: 'Tahu dan tempe bumbu kuning', price: 8000, stock: 100 },
            ],
        },
        {
            name: 'Nasi Goreng Nusantara',
            description: 'Spesialis nasi goreng berbagai bumbu daerah',
            menu: [
                { name: 'Nasgor Gila', description: 'Nasi goreng dengan isian sosis, bakso, telur', price: 25000, stock: 100 },
                { name: 'Nasgor Seafood', description: 'Nasi goreng cumi dan udang', price: 30000, stock: 100 },
                { name: 'Nasgor Kambing', description: 'Nasi goreng bumbu rempah kambing', price: 35000, stock: 100 },
                { name: 'Mie Goreng Spesial', description: 'Mie goreng telur dan sayuran', price: 22000, stock: 100 },
                { name: 'Telur Dadar Bareng', description: 'Ekstra telur dadar tebal', price: 6000, stock: 100 },
            ],
        },
        {
            name: 'Boba Time',
            description: 'Minuman kekinian boba dan milk tea',
            menu: [
                { name: 'Brown Sugar Boba', description: 'Susu segar, gula aren cair, dan boba', price: 24000, stock: 100 },
                { name: 'Matcha Latte', description: 'Susu segar dengan premium matcha', price: 26000, stock: 100 },
                { name: 'Taro Milk Tea', description: 'Teh susu rasa ubi ungu manis', price: 22000, stock: 100 },
                { name: 'Classic Milk Tea', description: 'Teh hitam seduh dengan susu', price: 18000, stock: 100 },
                { name: 'Lemon Tea', description: 'Teh rasa lemon segar', price: 15000, stock: 100 },
            ],
        },
        {
            name: 'Mie Ayam Gajah',
            description: 'Mie ayam porsi jumbo dengan topping melimpah',
            menu: [
                { name: 'Mie Ayam Biasa', description: 'Mie ayam original + pangsit rebus', price: 15000, stock: 100 },
                { name: 'Mie Ayam Bakso', description: 'Mie ayam + 3 bakso sapi', price: 20000, stock: 100 },
                { name: 'Mie Yamin Manis', description: 'Mie ayam kecap manis', price: 16000, stock: 100 },
                { name: 'Pangsit Goreng (Isi 5)', description: 'Pangsit isi ayam cincang goreng', price: 12000, stock: 100 },
                { name: 'Es Jeruk Peras', description: 'Jeruk peras murni', price: 10000, stock: 100 },
            ],
        },
        {
            name: 'Sate Madura Cak Udin',
            description: 'Sate ayam dan kambing bumbu kacang khas Madura',
            menu: [
                { name: 'Sate Ayam (10 Tusuk)', description: 'Sate daging ayam + bumbu kacang', price: 20000, stock: 100 },
                { name: 'Sate Kambing (10 Tusuk)', description: 'Sate daging kambing + bumbu kecap', price: 35000, stock: 100 },
                { name: 'Sate Taichan', description: 'Sate ayam putih polos dengan sambal pedas', price: 25000, stock: 100 },
                { name: 'Lontong', description: 'Lontong daun pisang', price: 4000, stock: 100 },
                { name: 'Es Dawet Ayu', description: 'Minuman dawet gula merah', price: 10000, stock: 100 },
            ],
        },
        {
            name: 'Martabak Manis Legit',
            description: 'Martabak manis premium dan martabak telur',
            menu: [
                { name: 'Martabak Coklat Kacang', description: 'Martabak manis klasik', price: 35000, stock: 100 },
                { name: 'Martabak Keju Susu', description: 'Martabak manis topping keju parut', price: 40000, stock: 100 },
                { name: 'Martabak 1/2 Coklat 1/2 Keju', description: 'Kombinasi 2 rasa favorit', price: 45000, stock: 100 },
                { name: 'Martabak Telur Spesial', description: 'Isi daging sapi cincang, 3 telur', price: 40000, stock: 100 },
                { name: 'Martabak Tipker Coklat', description: 'Martabak tipis kering renyah', price: 25000, stock: 100 },
            ],
        },
        {
            name: 'Bakso Urat Mantap',
            description: 'Bakso sapi asli Wonogiri',
            menu: [
                { name: 'Bakso Urat', description: 'Bakso urat sapi kasar + mie/bihun', price: 20000, stock: 100 },
                { name: 'Bakso Telur', description: 'Bakso sapi isi telur ayam utuh', price: 22000, stock: 100 },
                { name: 'Bakso Beranak', description: 'Bakso besar berisi bakso kecil', price: 35000, stock: 100 },
                { name: 'Tahu Bakso Goreng', description: 'Tahu isi adonan daging sapi', price: 15000, stock: 100 },
                { name: 'Es Campur Spesial', description: 'Es serut dengan aneka buah dan sirup', price: 15000, stock: 100 },
            ],
        },
        {
            name: 'Pempek Palembang Asli',
            description: 'Pempek ikan tenggiri asli dengan cuko kental',
            menu: [
                { name: 'Pempek Kapal Selam', description: 'Pempek besar isi telur utuh', price: 25000, stock: 100 },
                { name: 'Pempek Lenjer', description: 'Pempek bentuk panjang', price: 15000, stock: 100 },
                { name: 'Pempek Adaan', description: 'Pempek bulat gurih', price: 8000, stock: 100 },
                { name: 'Tekwan', description: 'Sup kaldu udang isi pentol pempek', price: 25000, stock: 100 },
                { name: 'Es Kacang Merah', description: 'Es serut kacang merah legit', price: 18000, stock: 100 },
            ],
        },
        {
            name: 'Salad Buah Segar',
            description: 'Pilihan buah segar dengan saus keju lumer',
            menu: [
                { name: 'Salad Buah Medium', description: 'Cup 400ml buah potong + saus keju', price: 25000, stock: 100 },
                { name: 'Salad Buah Large', description: 'Cup 750ml buah potong + saus keju', price: 40000, stock: 100 },
                { name: 'Jus Alpukat', description: 'Jus alpukat kental manis susu coklat', price: 15000, stock: 100 },
                { name: 'Jus Mangga', description: 'Jus mangga segar', price: 15000, stock: 100 },
                { name: 'Salad Sayur', description: 'Selada, tomat, jagung manis + thousand island', price: 20000, stock: 100 },
            ],
        }
    ];

    try {
        const existing = await tenantModel.findAll();
        const existingNames = existing.map((t) => t.name);

        // Filter tenant yang belum ada di database berdasarkan nama
        const newTenants = samples.filter((sample) => !existingNames.includes(sample.name));

        if (newTenants.length === 0) {
            logger.info('Semua sample tenant sudah ada di database.');
            await disconnectFromDatabase();
            process.exit(0);
        }

        // Loop dan create tenant yang belum ada
        const createdTenants = [];
        for (const tenantData of newTenants) {
            const created = await tenantModel.create(tenantData);
            createdTenants.push(created);
            logger.info({ tenantId: created._id.toString(), tenantName: created.name }, 'Created tenant');
        }

        logger.info({ createdCount: createdTenants.length }, 'Berhasil membuat tenant baru');
        await disconnectFromDatabase();
        process.exit(0);
    } catch (err) {
        logger.error({ err }, 'Error saat melakukan seeding');
        await disconnectFromDatabase();
        process.exit(1);
    }
}

seed();
