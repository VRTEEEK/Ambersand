-- ECC Mid-term Migration to Generic Regulations Model (Fixed)
-- Created: 2025-09-21

-- 1) Add projects.regulation_id to link projects to specific regulations
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS regulation_id INTEGER NULL
    REFERENCES regulations(id) ON DELETE SET NULL;

-- 2) Create mapping table to track ecc_controls -> regulation_controls migration
CREATE TABLE IF NOT EXISTS ecc_to_regulation_controls_map (
  ecc_id INTEGER PRIMARY KEY,
  regulation_control_id INTEGER UNIQUE NOT NULL
    REFERENCES regulation_controls(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3) Ensure all needed columns exist on regulation_controls (matching your schema)
ALTER TABLE regulation_controls
  ADD COLUMN IF NOT EXISTS clause_number VARCHAR,
  ADD COLUMN IF NOT EXISTS evidence_types TEXT[],
  ADD COLUMN IF NOT EXISTS weight NUMERIC;

-- 4) Add regulationControlId columns to legacy join tables for migration
-- Check if task_controls table exists and add column if needed
DO $main_block$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='task_controls') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='task_controls' AND column_name='regulation_control_id') THEN
      ALTER TABLE task_controls ADD COLUMN regulation_control_id INTEGER
        REFERENCES regulation_controls(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $main_block$;

-- Check if evidence_controls table exists and add column if needed
DO $evidence_block$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='evidence_controls') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='evidence_controls' AND column_name='regulation_control_id') THEN
      ALTER TABLE evidence_controls ADD COLUMN regulation_control_id INTEGER
        REFERENCES regulation_controls(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $evidence_block$;

-- 5) Create read-only trigger on ecc_controls to prevent modifications during migration
DO $trigger_block$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ecc_controls_readonly') THEN
    -- Create the trigger function
    CREATE OR REPLACE FUNCTION ecc_controls_readonly()
    RETURNS trigger AS $function_body$
    BEGIN
      RAISE EXCEPTION 'ecc_controls table is read-only during migration period. Use regulation_controls instead.';
    END;
    $function_body$ LANGUAGE plpgsql;

    -- Create the trigger
    CREATE TRIGGER trg_ecc_controls_readonly
      BEFORE INSERT OR UPDATE OR DELETE ON ecc_controls
      FOR EACH STATEMENT EXECUTE FUNCTION ecc_controls_readonly();
  END IF;
END $trigger_block$;

-- 6) Add indexes for better performance during migration and after
CREATE INDEX IF NOT EXISTS idx_projects_regulation_id ON projects(regulation_id);
CREATE INDEX IF NOT EXISTS idx_ecc_map_ecc_id ON ecc_to_regulation_controls_map(ecc_id);
CREATE INDEX IF NOT EXISTS idx_ecc_map_regulation_control_id ON ecc_to_regulation_controls_map(regulation_control_id);

-- Note: The actual data migration will be handled by the migrateECC.ts script
-- This ensures we can run it with proper logging, dry-run mode, and error handling