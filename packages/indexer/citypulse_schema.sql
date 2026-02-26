-- CityPulse için önerilen PostgreSQL + PostGIS şeması

-- Hazards tablosu
CREATE TABLE hazards (
    id SERIAL PRIMARY KEY,
    latE6 INTEGER NOT NULL,
    lonE6 INTEGER NOT NULL,
    category SMALLINT NOT NULL,
    severity SMALLINT NOT NULL,
    reporter VARCHAR(42) NOT NULL,
    note_uri TEXT,
    timestamp TIMESTAMP NOT NULL,
    closed BOOLEAN DEFAULT FALSE
);

-- Votes tablosu
CREATE TABLE votes (
    id SERIAL PRIMARY KEY,
    hazard_id INTEGER REFERENCES hazards(id) ON DELETE CASCADE,
    voter VARCHAR(42) NOT NULL,
    up BOOLEAN NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    UNIQUE(hazard_id, voter)
);

-- Grid hücreleri için aggregation tablosu
CREATE TABLE grid_cells (
    id SERIAL PRIMARY KEY,
    lat_grid INTEGER NOT NULL,
    lon_grid INTEGER NOT NULL,
    avg_risk INTEGER NOT NULL,
    hazard_count INTEGER NOT NULL,
    last_updated TIMESTAMP NOT NULL
);

-- Risk skoru view'u (örnek)
CREATE VIEW hazard_risk AS
SELECT
    h.id,
    h.latE6,
    h.lonE6,
    h.category,
    h.severity,
    h.closed,
    COALESCE(SUM(CASE WHEN v.up THEN 1 ELSE 0 END),0) AS upvotes,
    COALESCE(SUM(CASE WHEN NOT v.up THEN 1 ELSE 0 END),0) AS downvotes,
    MAX(v.timestamp) AS last_activity
FROM hazards h
LEFT JOIN votes v ON h.id = v.hazard_id
GROUP BY h.id;

-- PostGIS spatial index (isteğe bağlı)
CREATE INDEX hazards_location_idx ON hazards USING gist (ST_MakePoint(lonE6, latE6));
