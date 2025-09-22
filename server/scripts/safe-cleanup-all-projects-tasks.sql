-- Safe cleanup of all projects and tasks
-- This script uses conditional logic to handle missing tables

-- Start transaction for safety
BEGIN;

-- Function to safely delete from table if it exists
DO $$
BEGIN
    -- 1. Remove task-related data first
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='task_regulation_controls') THEN
        DELETE FROM task_regulation_controls;
        RAISE NOTICE 'Deleted from task_regulation_controls';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='task_controls') THEN
        DELETE FROM task_controls;
        RAISE NOTICE 'Deleted from task_controls';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='evidence_tasks') THEN
        DELETE FROM evidence_tasks;
        RAISE NOTICE 'Deleted from evidence_tasks';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='evidence_controls') THEN
        DELETE FROM evidence_controls;
        RAISE NOTICE 'Deleted from evidence_controls';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='evidence_comments') THEN
        DELETE FROM evidence_comments;
        RAISE NOTICE 'Deleted from evidence_comments';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='evidence_versions') THEN
        DELETE FROM evidence_versions;
        RAISE NOTICE 'Deleted from evidence_versions';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='evidence') THEN
        DELETE FROM evidence;
        RAISE NOTICE 'Deleted from evidence';
    END IF;

    -- 2. Remove workflow-related data
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='task_workflow_events') THEN
        DELETE FROM task_workflow_events;
        RAISE NOTICE 'Deleted from task_workflow_events';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='task_review_route') THEN
        DELETE FROM task_review_route;
        RAISE NOTICE 'Deleted from task_review_route';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='task_workflow') THEN
        DELETE FROM task_workflow;
        RAISE NOTICE 'Deleted from task_workflow';
    END IF;

    -- 3. Remove control assessments
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='control_assessments') THEN
        DELETE FROM control_assessments;
        RAISE NOTICE 'Deleted from control_assessments';
    END IF;

    -- 4. Remove all tasks
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='tasks') THEN
        DELETE FROM tasks;
        RAISE NOTICE 'Deleted from tasks';
    END IF;

    -- 5. Remove project-related data
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='project_regulation_controls') THEN
        DELETE FROM project_regulation_controls;
        RAISE NOTICE 'Deleted from project_regulation_controls';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='project_controls') THEN
        DELETE FROM project_controls;
        RAISE NOTICE 'Deleted from project_controls';
    END IF;

    -- 6. Remove compliance assessments
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='compliance_assessments') THEN
        DELETE FROM compliance_assessments;
        RAISE NOTICE 'Deleted from compliance_assessments';
    END IF;

    -- 7. Remove all projects
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='projects') THEN
        DELETE FROM projects;
        RAISE NOTICE 'Deleted from projects';
    END IF;

END $$;

-- Reset sequences to start from 1 again
DO $$
BEGIN
    -- Reset sequences if they exist
    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'projects_id_seq') THEN
        ALTER SEQUENCE projects_id_seq RESTART WITH 1;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'tasks_id_seq') THEN
        ALTER SEQUENCE tasks_id_seq RESTART WITH 1;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'evidence_id_seq') THEN
        ALTER SEQUENCE evidence_id_seq RESTART WITH 1;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'task_regulation_controls_id_seq') THEN
        ALTER SEQUENCE task_regulation_controls_id_seq RESTART WITH 1;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'task_controls_id_seq') THEN
        ALTER SEQUENCE task_controls_id_seq RESTART WITH 1;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'project_regulation_controls_id_seq') THEN
        ALTER SEQUENCE project_regulation_controls_id_seq RESTART WITH 1;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'project_controls_id_seq') THEN
        ALTER SEQUENCE project_controls_id_seq RESTART WITH 1;
    END IF;

    RAISE NOTICE 'Reset all sequences';
END $$;

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
    'Task Regulation Controls' as table_name, COUNT(*) as remaining_records FROM task_regulation_controls
UNION ALL
SELECT
    'Project Controls' as table_name, COUNT(*) as remaining_records FROM project_controls;