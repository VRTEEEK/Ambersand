-- Complete database cleanup: projects, tasks, risks, evidence, and users
-- This script safely removes all data from the system
-- WARNING: This will delete ALL user data including accounts

BEGIN;

-- Function to safely delete from tables if they exist
DO $$
BEGIN
    -- 1. Remove workflow-related data first
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

    -- 2. Remove evidence-related data
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='evidence_project_regulation_controls') THEN
        DELETE FROM evidence_project_regulation_controls;
        RAISE NOTICE 'Deleted from evidence_project_regulation_controls';
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

    -- 3. Remove task-related data
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='task_regulation_controls') THEN
        DELETE FROM task_regulation_controls;
        RAISE NOTICE 'Deleted from task_regulation_controls';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='task_controls') THEN
        DELETE FROM task_controls;
        RAISE NOTICE 'Deleted from task_controls';
    END IF;

    -- 4. Remove control assessments
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='control_assessments') THEN
        DELETE FROM control_assessments;
        RAISE NOTICE 'Deleted from control_assessments';
    END IF;

    -- 5. Remove all tasks
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='tasks') THEN
        DELETE FROM tasks;
        RAISE NOTICE 'Deleted from tasks';
    END IF;

    -- 6. Remove project-related data
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='project_regulation_controls') THEN
        DELETE FROM project_regulation_controls;
        RAISE NOTICE 'Deleted from project_regulation_controls';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='project_controls') THEN
        DELETE FROM project_controls;
        RAISE NOTICE 'Deleted from project_controls';
    END IF;

    -- 7. Remove compliance assessments
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='compliance_assessments') THEN
        DELETE FROM compliance_assessments;
        RAISE NOTICE 'Deleted from compliance_assessments';
    END IF;

    -- 8. Remove all projects
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='projects') THEN
        DELETE FROM projects;
        RAISE NOTICE 'Deleted from projects';
    END IF;

    -- 9. Remove risks and related data
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='risk_comments') THEN
        DELETE FROM risk_comments;
        RAISE NOTICE 'Deleted from risk_comments';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='risk_mitigations') THEN
        DELETE FROM risk_mitigations;
        RAISE NOTICE 'Deleted from risk_mitigations';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='risks') THEN
        DELETE FROM risks;
        RAISE NOTICE 'Deleted from risks';
    END IF;

    -- 10. Remove notifications
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='notifications') THEN
        DELETE FROM notifications;
        RAISE NOTICE 'Deleted from notifications';
    END IF;

    -- 11. Remove comments and subscriptions
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='comment_subscriptions') THEN
        DELETE FROM comment_subscriptions;
        RAISE NOTICE 'Deleted from comment_subscriptions';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='comments') THEN
        DELETE FROM comments;
        RAISE NOTICE 'Deleted from comments';
    END IF;

    -- 12. Remove user invites
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='user_invites') THEN
        DELETE FROM user_invites;
        RAISE NOTICE 'Deleted from user_invites';
    END IF;

    -- 13. Remove RBAC user assignments
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='user_project_roles') THEN
        DELETE FROM user_project_roles;
        RAISE NOTICE 'Deleted from user_project_roles';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='user_roles') THEN
        DELETE FROM user_roles;
        RAISE NOTICE 'Deleted from user_roles';
    END IF;

    -- 14. Remove user sessions
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='sessions') THEN
        DELETE FROM sessions;
        RAISE NOTICE 'Deleted from sessions';
    END IF;

    -- 15. Remove all users
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='users') THEN
        DELETE FROM users;
        RAISE NOTICE 'Deleted from users';
    END IF;

END $$;

-- Reset sequences to start from 1 again
DO $$
BEGIN
    -- Reset project and task sequences
    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'projects_id_seq') THEN
        ALTER SEQUENCE projects_id_seq RESTART WITH 1;
        RAISE NOTICE 'Reset projects_id_seq';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'tasks_id_seq') THEN
        ALTER SEQUENCE tasks_id_seq RESTART WITH 1;
        RAISE NOTICE 'Reset tasks_id_seq';
    END IF;

    -- Reset evidence sequences
    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'evidence_id_seq') THEN
        ALTER SEQUENCE evidence_id_seq RESTART WITH 1;
        RAISE NOTICE 'Reset evidence_id_seq';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'evidence_versions_id_seq') THEN
        ALTER SEQUENCE evidence_versions_id_seq RESTART WITH 1;
        RAISE NOTICE 'Reset evidence_versions_id_seq';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'evidence_comments_id_seq') THEN
        ALTER SEQUENCE evidence_comments_id_seq RESTART WITH 1;
        RAISE NOTICE 'Reset evidence_comments_id_seq';
    END IF;

    -- Reset control-related sequences
    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'task_regulation_controls_id_seq') THEN
        ALTER SEQUENCE task_regulation_controls_id_seq RESTART WITH 1;
        RAISE NOTICE 'Reset task_regulation_controls_id_seq';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'task_controls_id_seq') THEN
        ALTER SEQUENCE task_controls_id_seq RESTART WITH 1;
        RAISE NOTICE 'Reset task_controls_id_seq';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'project_regulation_controls_id_seq') THEN
        ALTER SEQUENCE project_regulation_controls_id_seq RESTART WITH 1;
        RAISE NOTICE 'Reset project_regulation_controls_id_seq';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'project_controls_id_seq') THEN
        ALTER SEQUENCE project_controls_id_seq RESTART WITH 1;
        RAISE NOTICE 'Reset project_controls_id_seq';
    END IF;

    -- Reset assessment sequences
    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'compliance_assessments_id_seq') THEN
        ALTER SEQUENCE compliance_assessments_id_seq RESTART WITH 1;
        RAISE NOTICE 'Reset compliance_assessments_id_seq';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'control_assessments_id_seq') THEN
        ALTER SEQUENCE control_assessments_id_seq RESTART WITH 1;
        RAISE NOTICE 'Reset control_assessments_id_seq';
    END IF;

    -- Reset risk sequences
    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'risks_id_seq') THEN
        ALTER SEQUENCE risks_id_seq RESTART WITH 1;
        RAISE NOTICE 'Reset risks_id_seq';
    END IF;

    -- Reset notification sequences
    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'notifications_id_seq') THEN
        ALTER SEQUENCE notifications_id_seq RESTART WITH 1;
        RAISE NOTICE 'Reset notifications_id_seq';
    END IF;

    -- Reset workflow sequences
    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'task_review_route_id_seq') THEN
        ALTER SEQUENCE task_review_route_id_seq RESTART WITH 1;
        RAISE NOTICE 'Reset task_review_route_id_seq';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'task_workflow_id_seq') THEN
        ALTER SEQUENCE task_workflow_id_seq RESTART WITH 1;
        RAISE NOTICE 'Reset task_workflow_id_seq';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'task_workflow_events_id_seq') THEN
        ALTER SEQUENCE task_workflow_events_id_seq RESTART WITH 1;
        RAISE NOTICE 'Reset task_workflow_events_id_seq';
    END IF;

    -- Reset comments sequences
    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'comments_id_seq') THEN
        ALTER SEQUENCE comments_id_seq RESTART WITH 1;
        RAISE NOTICE 'Reset comments_id_seq';
    END IF;

    -- Reset user invites sequences
    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'user_invites_id_seq') THEN
        ALTER SEQUENCE user_invites_id_seq RESTART WITH 1;
        RAISE NOTICE 'Reset user_invites_id_seq';
    END IF;

END $$;

-- Commit the transaction
COMMIT;

-- Display cleanup summary
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Database Cleanup Summary';
    RAISE NOTICE '========================================';
END $$;

SELECT 'Projects' as table_name,
       COALESCE((SELECT COUNT(*) FROM projects), 0) as remaining_records
UNION ALL
SELECT 'Tasks',
       COALESCE((SELECT COUNT(*) FROM tasks), 0)
UNION ALL
SELECT 'Evidence',
       COALESCE((SELECT COUNT(*) FROM evidence), 0)
UNION ALL
SELECT 'Risks',
       COALESCE((SELECT COUNT(*) FROM risks), 0)
UNION ALL
SELECT 'Users',
       COALESCE((SELECT COUNT(*) FROM users), 0)
UNION ALL
SELECT 'Sessions',
       COALESCE((SELECT COUNT(*) FROM sessions), 0)
ORDER BY table_name;
