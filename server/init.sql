-- SQL script to initialize the database
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

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_setup_org_project ON setup(org, project);
