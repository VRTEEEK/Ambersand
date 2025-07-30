# Ambersand - Compliance Management System

## Overview

Ambersand is a modern, bilingual (Arabic/English) compliance management platform designed for mid-to-large Saudi organizations. The system helps organizations streamline adherence to key regulatory frameworks including ECC (Essential Cybersecurity Controls), PDPL (Personal Data Protection Law), and NDMO (National Data Management Office).

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### July 30, 2025 - Complete TaskDetail Page Modern Redesign & Enhanced UI Components  
- **REDESIGNED**: Complete TaskDetail page with modern glassmorphism design, gradient headers, and enhanced visual hierarchy
- **MODERNIZED**: Task information section with gradient backgrounds, rounded corners, and improved typography
- **ENHANCED**: Tabs system with active state styling, smooth transitions, and teal accent colors for professional appearance
- **REDESIGNED**: Controls tab with modern card layouts, hover animations, and comprehensive control information display
- **MODERNIZED**: Evidence tab with purple theme, modern upload dialogs, and enhanced file management interface
- **IMPLEMENTED**: Grid and list view modes for controls with modern card designs and professional styling
- **ENHANCED**: Evidence management with gradient cards, hover effects, and improved upload/link functionality
- **IMPROVED**: Dialog components with modern headers, colored icons, and enhanced user experience
- **STANDARDIZED**: Consistent use of gradient backgrounds, glassmorphism effects, and modern UI patterns
- **UPGRADED**: Visual feedback with hover states, scale animations, and smooth transitions throughout the page

### July 30, 2025 - Regulations Page Modern Redesign & Search Integration
- **REDESIGNED**: Complete Regulations page with modern glassmorphism card styling and gradient headers
- **INTEGRATED**: TaskSearchInput component across all pages (MyTasks, Tasks, Projects, Evidence, Regulations) for consistent search interface
- **ENHANCED**: ECC Framework Details card with teal gradient header, backdrop blur effects, and improved search styling
- **MODERNIZED**: Domain cards with hover animations, gradient overlays, scale effects, and enhanced visual feedback
- **UPDATED**: Other Framework Details (PDPL/NDMO) with gray color scheme instead of blue/purple for better website alignment
- **IMPROVED**: Control details section with modern header styling, gradient backgrounds, and professional appearance
- **STANDARDIZED**: Search functionality using unified TaskSearchInput component with bilingual support across entire application
- **ENHANCED**: Visual consistency with glassmorphism effects, shadow depth, and smooth transitions throughout Regulations interface

### July 30, 2025 - Task Delete Functionality, UI Enhancements & Analytics Regulation Filter Implementation
- **IMPLEMENTED**: Complete task deletion functionality with confirmation dialog in task edit form
- **ADDED**: Red delete button with trash icon in bottom left of EditTaskForm component with bilingual support
- **CREATED**: Confirmation AlertDialog with Arabic/English text asking for user confirmation before deletion
- **INTEGRATED**: Delete mutation with proper error handling, toast notifications, and loading states
- **ENHANCED**: Tasks page with onDelete prop handler that calls DELETE /api/tasks/:id endpoint
- **TESTED**: Successful deletion workflow verified - task 55 deleted successfully with proper cleanup
- **IMPROVED**: Project owner display in Projects page to show only name without "Project Owner" title text
- **REDESIGNED**: Regulation framework cards with modern gradients, animations, decorative elements, and enhanced hover effects
- **IMPLEMENTED**: Hover tooltips for control badges in ProjectDetail page showing comprehensive control information including code, domain, subdomain, control description, and required evidence with bilingual support
- **ENHANCED**: Analytics page with regulation-specific compliance trend filtering dropdown allowing users to view trends for specific regulations (ECC, PDPL, NDMO) or all regulations combined
- **ADDED**: Comprehensive regulation data structures with distinct compliance trend data for each regulation framework with appropriate targets and performance metrics
- **IMPROVED**: Compliance Trend chart header layout with regulation filter dropdown positioned on the right side for easy access and professional appearance

### July 29, 2025 - Complete Email Notification System Implementation & Production URL Fix
- **IMPLEMENTED**: Automatic email notifications for task assignments with bilingual templates supporting Arabic RTL text
- **CONFIGURED**: Resend email service with proper domain verification (noreply@resend.dev) and RESEND_API_KEY integration
- **CREATED**: Comprehensive email templates for task assignment, deadline reminders, and status updates in both Arabic and English
- **ENHANCED**: Task creation and update workflows to automatically send emails when tasks are assigned to different users
- **ADDED**: Direct task detail links in emails using `?task=id` parameter that automatically opens task details dialog
- **BUILT**: Email testing interface at `/email-test` for testing all email template types
- **INTEGRATED**: Email link handling in Tasks page to automatically open specific tasks from email notifications
- **DEBUGGING**: Added comprehensive logging system to track email notification triggers and delivery status
- **FIXED**: Email task links to use BASE_URL environment variable for correct production domain (https://ambersand-v1.replit.app)
- **UPDATED**: All email templates now dynamically generate links based on deployment environment instead of hardcoded localhost URLs
- **CORRECTED**: Email task links now use proper route format `/tasks/{id}` instead of query parameter format for direct task detail navigation
- **IMPLEMENTED**: Automatic production domain detection using REPLIT_CLUSTER environment variable for seamless deployment without manual configuration

### July 16, 2025 - Evidence Version Notes Integration & Dialog Optimization
- **IMPLEMENTED**: Complete version notes integration with comment system for comprehensive audit trail
- **ENHANCED**: Version uploads with notes automatically create system comments with amber styling and distinct visual treatment
- **AUTOMATED**: Backend automatically formats version notes as "Uploaded version X.X: [note]" with system comment metadata
- **REDESIGNED**: Evidence Details dialog with tabs positioned at top of window and compressed Upload Version tab content
- **OPTIMIZED**: Upload Version tab layout to fit within dialog bounds with reduced spacing and compact form elements
- **MODERNIZED**: Tab styling with active state highlighting, smooth transitions, and teal accent colors for professional appearance
- **STANDARDIZED**: All tab content areas use consistent padding and unified scrolling behavior throughout dialog
- **IMPROVED**: Download File button repositioned to center bottom of Details tab with enhanced styling and hover effects
- **ENHANCED**: Comment system with visual distinction between user comments and system-generated version logs
- **UNIFIED**: All buttons, badges, and interactive elements follow consistent design patterns with proper transitions

### July 16, 2025 - Profile Picture System Implementation  
- **IMPLEMENTED**: Complete profile picture upload functionality with file validation (.jpg, .png, .webp)
- **CREATED**: UserAvatar component for consistent circular avatar display across application
- **UPDATED**: All Avatar components replaced with UserAvatar throughout the app (Users, AppLayout, UserProfile, Projects pages)
- **ADDED**: Backend file upload routes and static file serving for profile pictures
- **ENHANCED**: User management with profile picture upload dialogs and real-time updates
- **STANDARDIZED**: Avatar display with consistent sizing (sm=24px, md=32px, lg=40px, xl=48px, 2xl=64px) and fallback to user initials
- **INTEGRATED**: Profile pictures now display wherever users appear (project owners, task assignees, navigation)

### July 12, 2025 - UI Consistency and Header Improvements
- **REDESIGNED**: Analytics page header to match Notifications and Users page styling with background image
- **UPDATED**: Regulation framework cards with professional gray theme and consistent styling
- **ENHANCED**: Select All button with dynamic gray/teal styling based on selection state
- **FIXED**: Notification badge count to reflect actual unread notifications (3 unread out of 5 total)
- **REMOVED**: AvatarFallback component from user menu as requested
- **IMPROVED**: Visual consistency across all pages using clean gray theme and professional layouts
- **STANDARDIZED**: Header sections across Analytics, Notifications, and Users pages with same background treatment
- All pages now follow the same professional color palette without unusual colors

## System Architecture

### Frontend Architecture
- **React with TypeScript**: Modern component-based UI using React 18+ with full TypeScript support
- **Vite Build System**: Fast development and optimized production builds
- **Wouter Router**: Lightweight client-side routing for single-page application navigation
- **Shadcn/ui Components**: High-quality, accessible UI components built on Radix UI primitives
- **Tailwind CSS**: Utility-first CSS framework with custom design tokens for Ambersand branding
- **TanStack Query**: Server state management with caching, background updates, and optimistic updates

### Backend Architecture
- **Express.js Server**: RESTful API server with TypeScript
- **Node.js Runtime**: ESM module system for modern JavaScript features
- **Drizzle ORM**: Type-safe database operations with PostgreSQL
- **Session-based Authentication**: Secure session management using Replit Auth integration
- **File Upload Support**: Multer middleware for evidence file handling

### Database Design
- **PostgreSQL**: Primary database using Neon serverless PostgreSQL
- **Drizzle Schema**: Type-safe database schema with relations
- **Core Entities**:
  - Users and Organizations
  - Projects and Tasks
  - Project Controls (Many-to-Many association)
  - Evidence and Attachments
  - Compliance Assessments
  - ECC Controls and Regulations
- **ECC Data**: 201 predefined ECC controls with Arabic/English content
- **Control Relationships**: Projects can be associated with multiple ECC controls

## Key Components

### Authentication System
- **Replit Auth Integration**: OAuth-based authentication with session management
- **Role-based Access Control**: Admin, manager, and viewer roles
- **Session Storage**: PostgreSQL-backed session store for scalability

### Compliance Management
- **Regulation Library**: Predefined regulatory frameworks (ECC, PDPL, NDMO)
- **Project Management**: Create and track compliance projects with hierarchical control selection
- **Control Association**: Many-to-many relationship between projects and ECC controls
- **Task Management**: Assign and monitor compliance tasks with deadlines and priorities
- **Evidence Management**: Upload and organize supporting documents and files

### Project Control Selection
- **Hierarchical Interface**: Browse ECC controls organized by domains and subdomains
- **Real-time Selection**: Interactive control selection with live counter
- **Evidence Requirements**: Display required evidence types for each control
- **Collapsible Navigation**: Expandable domain/subdomain tree structure

### Internationalization
- **Bilingual Support**: Arabic and English language support
- **RTL Layout**: Right-to-left text direction for Arabic content
- **Custom i18n Hook**: Centralized translation management with language switching

### Dashboard and Analytics
- **Metrics Overview**: Compliance scores, project status, and task tracking
- **Chart Visualization**: Chart.js integration for compliance trends and progress
- **Quick Actions**: Fast access to common operations like creating projects and uploading evidence

## Data Flow

### Client-Server Communication
1. **React Frontend** makes API requests to Express backend
2. **TanStack Query** manages client-side caching and synchronization
3. **Express Routes** handle business logic and database operations
4. **Drizzle ORM** provides type-safe database queries to PostgreSQL
5. **Session Middleware** ensures authenticated access to protected resources

### File Upload Flow
1. Client uploads files through multipart forms
2. Multer middleware processes and stores files locally
3. File metadata stored in database with project/task associations
4. Evidence records link files to compliance activities

### Authentication Flow
1. Users authenticate via Replit OAuth
2. Session created and stored in PostgreSQL
3. Protected routes verify session validity
4. User profile and organization data loaded from database

## External Dependencies

### Core Libraries
- **@neondatabase/serverless**: Neon PostgreSQL database client
- **drizzle-orm**: Type-safe ORM for database operations
- **express**: Web application framework
- **react & react-dom**: UI library and DOM renderer
- **@tanstack/react-query**: Server state management
- **wouter**: Client-side routing

### UI and Styling
- **@radix-ui/***: Accessible UI component primitives
- **tailwindcss**: Utility-first CSS framework
- **lucide-react**: Icon library
- **chart.js**: Data visualization

### Development Tools
- **vite**: Build tool and development server
- **typescript**: Type safety and enhanced developer experience
- **tsx**: TypeScript execution for development

### Authentication
- **passport**: Authentication middleware
- **openid-client**: OAuth/OIDC client for Replit Auth
- **express-session**: Session management
- **connect-pg-simple**: PostgreSQL session store

## Deployment Strategy

### Development Environment
- **Replit Integration**: Optimized for Replit development environment
- **Hot Module Replacement**: Vite provides fast development feedback
- **Database Migrations**: Drizzle Kit for schema management

### Production Build
- **Client Build**: Vite builds optimized static assets
- **Server Build**: esbuild bundles Node.js server for production
- **Environment Variables**: Database URL and session secrets via environment configuration

### Database Management
- **Schema Versioning**: Drizzle migrations for database schema changes
- **Connection Pooling**: Neon serverless handles connection management
- **Session Storage**: PostgreSQL-backed sessions for scalability

The application follows a modern full-stack architecture with strong typing throughout, comprehensive internationalization support, and a focus on compliance management workflows specific to Saudi regulatory requirements.