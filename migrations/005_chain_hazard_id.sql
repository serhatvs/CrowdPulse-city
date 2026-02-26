ALTER TABLE hazards
	ADD COLUMN IF NOT EXISTS chain_hazard_id BIGINT,
	ADD COLUMN IF NOT EXISTS closed BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hazards_chain_id
	ON hazards(chain_hazard_id)
	WHERE chain_hazard_id IS NOT NULL;