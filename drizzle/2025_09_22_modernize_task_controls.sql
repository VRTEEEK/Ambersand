-- Modernize Task Controls Migration
-- Created: 2025-09-22
-- Purpose: Replace deprecated eccControl system with modern regulation controls

-- 1) Create the modern task_regulation_controls table
CREATE TABLE IF NOT EXISTS task_regulation_controls (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  control_id INTEGER NOT NULL REFERENCES regulation_controls(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(task_id, control_id)
);

-- 2) Create indexes for performance
CREATE INDEX IF NOT EXISTS task_regulation_controls_task_idx ON task_regulation_controls(task_id);
CREATE INDEX IF NOT EXISTS task_regulation_controls_unique ON task_regulation_controls(task_id, control_id);

-- 3) Migrate existing data from legacy task_controls to modern task_regulation_controls
-- This uses the ecc_to_regulation_controls_map to convert old ecc_control_id to regulation_control_id
INSERT INTO task_regulation_controls (task_id, control_id, created_at)
SELECT DISTINCT
  tc.task_id,
  map.regulation_control_id,
  tc.created_at
FROM task_controls tc
INNER JOIN ecc_to_regulation_controls_map map ON tc.ecc_control_id = map.ecc_id
WHERE NOT EXISTS (
  -- Avoid duplicates
  SELECT 1 FROM task_regulation_controls trc
  WHERE trc.task_id = tc.task_id
  AND trc.control_id = map.regulation_control_id
);

-- 4) Add a comment to the legacy table indicating it's deprecated
COMMENT ON TABLE task_controls IS 'DEPRECATED: Use task_regulation_controls instead. This table is kept for backwards compatibility.';

-- 5) Create a view for backwards compatibility (optional)
-- This view allows old code to still work while we transition
CREATE OR REPLACE VIEW task_controls_legacy_view AS
SELECT
  trc.id,
  trc.task_id,
  trc.control_id as ecc_control_id,  -- Map regulation control ID to legacy field name
  trc.created_at
FROM task_regulation_controls trc;

COMMENT ON VIEW task_controls_legacy_view IS 'Backwards compatibility view mapping modern task_regulation_controls to legacy task_controls structure';