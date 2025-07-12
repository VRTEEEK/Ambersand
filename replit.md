# Ambersand - Compliance Management System

## Overview

Ambersand is a modern, bilingual (Arabic/English) compliance management platform designed for mid-to-large Saudi organizations. The system helps organizations streamline adherence to key regulatory frameworks including ECC (Essential Cybersecurity Controls), PDPL (Personal Data Protection Law), and NDMO (National Data Management Office).

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

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