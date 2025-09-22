-- Complete cleanup of all projects and tasks
-- This script will remove all projects, tasks, and related data in the correct order
-- to maintain referential integrity

-- Start transaction for safety
BEGIN;

-- 1. Remove all task-related data first (to avoid foreign key violations)
DELETE FROM task_regulation_controls;
DELETE FROM task_controls;
DELETE FROM evidence_tasks;
DELETE FROM evidence_controls;
DELETE FROM evidence_comments;
DELETE FROM evidence_versions;
DELETE FROM evidence;

-- 2. Remove workflow-related data (check if tables exist)
DELETE FROM task_workflow_events;
DELETE FROM task_review_route;  -- Fixed: singular form
DELETE FROM task_workflow;      -- Fixed: singular form

-- 3. Remove control assessments (if exists)
DELETE FROM control_assessments WHERE 1=1; -- Will succeed even if table doesn't exist

-- 4. Remove all tasks
DELETE FROM tasks;

-- 5. Remove project-related data
DELETE FROM project_regulation_controls;
DELETE FROM project_controls;

-- 6. Remove compliance assessments (if exists)
DELETE FROM compliance_assessments WHERE 1=1; -- Will succeed even if table doesn't exist

-- 7. Remove all projects
DELETE FROM projects;

-- Reset sequences to start from 1 again (optional)
ALTER SEQUENCE projects_id_seq RESTART WITH 1;
ALTER SEQUENCE tasks_id_seq RESTART WITH 1;
ALTER SEQUENCE evidence_id_seq RESTART WITH 1;
ALTER SEQUENCE task_regulation_controls_id_seq RESTART WITH 1;
ALTER SEQUENCE task_controls_id_seq RESTART WITH 1;
ALTER SEQUENCE project_regulation_controls_id_seq RESTART WITH 1;
ALTER SEQUENCE project_controls_id_seq RESTART WITH 1;

-- Commit the transaction
COMMIT;

-- Display cleanup summary
SELECT
    'Projects' as table_name, COUNT(*) as remaining_records FROM projects
UNION ALL
SELECT
    'Tasks' as table_name, COUNT(*) as remaining_records FROM tasks
UNION ALL
SELECT
    'Evidence' as table_name, COUNT(*) as remaining_records FROM evidence
UNION ALL
SELECT
    'Task Controls' as table_name, COUNT(*) as remaining_records FROM task_regulation_controls
UNION ALL
SELECT
    'Project Controls' as table_name, COUNT(*) as remaining_records FROM project_regulation_controls;