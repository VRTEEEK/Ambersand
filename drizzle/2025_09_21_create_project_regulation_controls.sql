-- Migration: Create project_regulation_controls table
-- This table manages project-specific regulation control assignments and statuses

CREATE TABLE IF NOT EXISTS project_regulation_controls (
    id serial PRIMARY KEY,
    project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    control_id integer NOT NULL REFERENCES regulation_controls(id) ON DELETE CASCADE,
    status varchar NOT NULL DEFAULT 'pending',
    assigned_to varchar,
    due_date date,
    completed_at timestamp,
    notes text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS project_regulation_controls_project_idx ON project_regulation_controls (project_id);
CREATE INDEX IF NOT EXISTS project_regulation_controls_control_idx ON project_regulation_controls (control_id);
CREATE INDEX IF NOT EXISTS project_regulation_controls_status_idx ON project_regulation_controls (status);

-- Create unique constraint to prevent duplicate assignments
CREATE UNIQUE INDEX IF NOT EXISTS project_regulation_controls_uq ON project_regulation_controls (project_id, control_id);

-- Add comment to explain the table
COMMENT ON TABLE project_regulation_controls IS 'Association table for project-specific regulation control assignments and compliance status tracking';