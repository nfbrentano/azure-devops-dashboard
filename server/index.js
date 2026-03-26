const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize Postgres Pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Initialize database table
const initDb = async () => {
    try {
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
            CREATE INDEX IF NOT EXISTS idx_setup_org_project ON setup(org, project);
        `);
        console.log('Database initialized successfully');
    } catch (err) {
        console.error('Error initializing database:', err);
    }
};

initDb();

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

/**
 * Save setup configuration
 */
app.post('/api/setup', async (req, res) => {
    const { org, project, companyName, encryptedPat, iv, password } = req.body;

    if (!org || !project || !encryptedPat || !iv || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);
        
        const result = await pool.query(
            'INSERT INTO setup (org, project, company_name, encrypted_pat, iv, password_hash) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [org, project, companyName, encryptedPat, iv, passwordHash]
        );

        res.status(201).json({ message: 'Setup saved successfully', id: result.rows[0].id });
    } catch (error) {
        console.error('Error saving setup:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Retrieve setup configuration
 */
app.post('/api/setup/retrieve', async (req, res) => {
    const { org, project } = req.body;

    if (!org || !project) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Find setups for this org/project
        const result = await pool.query(
            'SELECT * FROM setup WHERE org = $1 AND project = $2 ORDER BY created_at DESC LIMIT 1',
            [org, project]
        );

        const setup = result.rows[0];

        if (!setup) {
            return res.status(404).json({ error: 'No setup found for this organization and project' });
        }

        return res.json({
            org: setup.org,
            project: setup.project,
            companyName: setup.company_name,
            encryptedPat: setup.encrypted_pat,
            iv: setup.iv
        });
    } catch (error) {
        console.error('Error retrieving setup:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(port, () => {
    console.log(`Backend listening at http://localhost:${port}`);
});
