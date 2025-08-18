# Ambersand - Compliance Management System

## Overview

Ambersand is a bilingual (Arabic/English) compliance management platform for mid-to-large Saudi organizations. Its primary purpose is to streamline adherence to key regulatory frameworks, including ECC (Essential Cybersecurity Controls), PDPL (Personal Data Protection Law), and NDMO (National Data Management Office). The project vision is to provide a comprehensive solution for managing organizational compliance efficiently and effectively.

## Recent Changes (August 2025)

- **CRITICAL: FIXED TaskWizard dialog dismissal issue** - Completely resolved the task creation form not closing after successful submission by moving handleClose() to the beginning of the onSuccess callback
- **MAJOR: Completed SendGrid email configuration** - Successfully configured email system with verified sender (rakan@ambersand.ai), proper branding (Ambersand Compliance), and correct base URL for production deployment
- **Enhanced email service architecture** - Created centralized EmailService class with proper environment variable handling, base URL detection, and extensive template library
- **Fixed task creation email notifications** - Resolved user ID handling issues and implemented proper error logging for email delivery during task assignments
- **IMPORTANT: SendGrid sender verification required** - Email system configured but requires sender identity verification in SendGrid dashboard for rakan@ambersand.ai before emails can be sent
- **CRITICAL: Fixed production email constraint error** - Enhanced upsertUser function to handle email unique constraint violations (Error 23505) by properly updating existing users instead of failing
- **Added comprehensive email testing** - Implemented /api/test-email endpoint with support for task assignments, invitations, deadline reminders, status updates, and password resets
- **Fixed TaskWizard form submission** - Enhanced onSubmit function with proper logging and validation, resolved "Create Task" button not working
- **Fixed React Query initialization** - Moved useEffect listener after query definitions to prevent "refetchTasks before initialization" error
- **Completed React Query v5 migration** - Updated all remaining cacheTime references to gcTime for full compatibility
- **Fixed deployment build warnings** - Removed duplicate method definitions in storage.ts (assignUserProjectRole, removeUserProjectRole)
- **Fixed custom regulation deletion bug** - Enhanced deletion mutation with proper state management, dialog cleanup, and error handling to support consecutive deletions
- **Improved regulation routing** - Fixed 404 errors when clicking regulation domain cards by implementing proper URL parameter navigation
- **Enhanced ProjectDetail navigation** - Added automatic Controls tab switching and domain filtering when accessed from regulation dashboard
- **Added visual feedback** - Implemented domain filter notices and "Show All Domains" functionality in project controls view

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Technology Stack**: React with TypeScript, Vite build system.
- **UI Framework**: Shadcn/ui components built on Radix UI, styled with Tailwind CSS (custom Ambersand branding).
- **Routing**: Wouter for lightweight client-side navigation.
- **State Management**: TanStack Query for server state management (caching, background updates, optimistic updates).

### Backend Architecture
- **Technology Stack**: Express.js server with TypeScript, Node.js runtime (ESM modules).
- **ORM**: Drizzle ORM for type-safe database operations with PostgreSQL.
- **Authentication**: Session-based authentication integrated with Replit Auth.
- **File Handling**: Multer middleware for evidence file uploads.

### Database Design
- **Database**: PostgreSQL (Neon serverless).
- **Schema Management**: Drizzle ORM for type-safe schema and relations.
- **Core Entities**: Users, Organizations, Projects, Tasks, Project Controls, Evidence, Attachments, Compliance Assessments, ECC Controls, and Regulations.
- **Key Data**: Includes 201 predefined ECC controls with Arabic/English content.
- **Relationships**: Projects can be associated with multiple ECC controls.

### Key Features
- **Authentication**: Replit Auth integration, role-based access control (Admin, Manager, Viewer), PostgreSQL-backed session storage.
- **Compliance Management**: Predefined regulatory frameworks (ECC, PDPL, NDMO), project management with hierarchical control selection, task assignment/monitoring, evidence management.
- **Email Integration**: SendGrid Web API with comprehensive templates for task notifications, user invitations, deadline reminders, status updates, and password resets.
- **Internationalization**: Bilingual support (Arabic/English) with RTL layout for Arabic content, custom i18n hook.
- **Dashboard & Analytics**: Overview of compliance scores, project status, task tracking, Chart.js integration for trend visualization, quick actions.

### Data Flow
- **Client-Server**: React frontend uses TanStack Query to make API requests to the Express backend. Express routes handle business logic and database operations via Drizzle ORM.
- **File Upload**: Client uploads files, Multer processes them, and metadata is stored in the database, linking files to compliance activities.
- **Authentication**: Replit OAuth authenticates users, creates sessions in PostgreSQL, and verifies sessions for protected routes.

## External Dependencies

### Core Libraries
- `@neondatabase/serverless`: Neon PostgreSQL client.
- `drizzle-orm`: Type-safe ORM.
- `express`: Web application framework.
- `react`, `react-dom`: UI library.
- `@tanstack/react-query`: Server state management.
- `wouter`: Client-side routing.
- `@sendgrid/mail`: Email delivery via SendGrid Web API.

### UI and Styling
- `@radix-ui/*`: Accessible UI component primitives.
- `tailwindcss`: Utility-first CSS framework.
- `lucide-react`: Icon library.
- `chart.js`: Data visualization.

### Authentication
- `passport`: Authentication middleware.
- `openid-client`: OAuth/OIDC client.
- `express-session`: Session management.
- `connect-pg-simple`: PostgreSQL session store.