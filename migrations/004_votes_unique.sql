DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'uq_vote'
	) THEN
		ALTER TABLE votes
			ADD CONSTRAINT uq_vote UNIQUE (hazard_id, voter);
	END IF;
END$$;