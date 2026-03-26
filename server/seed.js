require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function seed() {
    try {
        console.log('Iniciando seeding do banco de dados...');
        
        // Criar tabela de usuários
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Criar tabela de setup (garantir que existe)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS setup (
                id SERIAL PRIMARY KEY,
                org TEXT NOT NULL,
                project TEXT NOT NULL,
                company_name TEXT,
                encrypted_pat TEXT NOT NULL,
                iv TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        const adminPassword = 'abt576';
        const adminHash = await bcrypt.hash(adminPassword, 10);
        
        await pool.query(`
            INSERT INTO users (username, password_hash) 
            VALUES ($1, $2)
            ON CONFLICT (username) DO UPDATE SET password_hash = $2
        `, ['admin', adminHash]);

        console.log('✅ Usuário "admin" criado/atualizado com sucesso!');
        console.log('🚀 Senha configurada: abt576');
        process.exit(0);
    } catch (err) {
        console.error('❌ Erro no seeding:', err);
        process.exit(1);
    }
}

seed();
