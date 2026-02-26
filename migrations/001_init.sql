-- Hazards tablosu
CREATE TABLE IF NOT EXISTS hazards (
    id SERIAL PRIMARY KEY,
    latE6 INTEGER NOT NULL,
    lonE6 INTEGER NOT NULL,
    type VARCHAR(32) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(64)
);

-- Votes tablosu
CREATE TABLE IF NOT EXISTS votes (
    id SERIAL PRIMARY KEY,
    hazard_id INTEGER REFERENCES hazards(id) ON DELETE CASCADE,
    voter VARCHAR(64) NOT NULL,
    value INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexler
CREATE INDEX IF NOT EXISTS idx_hazards_latlon ON hazards(latE6, lonE6);
CREATE INDEX IF NOT EXISTS idx_votes_hazard_id ON votes(hazard_id);