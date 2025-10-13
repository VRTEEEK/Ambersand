import type { Express } from "express";
import express from "express";
import { z } from "zod";
import { getComplianceReportData } from "./reports/reportData";
import { renderComplianceHTML } from "./reports/html";
import { buildPDF, buildDOCX, buildXLSX, streamBundle } from "./reports/reportBuilders";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { createServer, type Server } from "http";
import { storage } from "./storage";
// DEPRECATED: Old Replit OAuth authentication - replaced with email/password JWT auth
// import { setupAuth, requireAuth } from "./replitAuth";
import { requireAuth, type AuthRequest } from "./middleware/authMiddleware";
import {
  insertProjectSchema,
  insertTaskSchema,
  insertEvidenceSchema,
  insertComplianceAssessmentSchema,
  insertControlAssessmentSchema,
  users,
  userInvites,
  evidence,
  evidenceVersions,
  evidenceComments,
  evidenceControls,
  evidenceTasks,
  taskRegulationControls,
  projectRegulationControls,
} from "@shared/schema";
import risksRouter from "./routes/risks";
import analyticsRouter from "./routes/analytics";
import workflowsRouter from "./routes/workflows";
import regulationsRouter from "./routes/regulations";
import projectsRouter from "./routes/projects";
import notificationsRouter from "./routes/notifications";
import authRouter from "./routes/auth";
import multer from "multer";
import path from "path";
import fs from "fs";
import { emailService } from "./emailService";
import * as XLSX from 'xlsx';
import { parse as parseCsv } from 'csv-parse/sync';
import { 
  requirePermissions, 
  requireViewRegulations, 
  requireCreateProjects, 
  requireCreateTasks,
  requireViewEvidence,
  requireEditEvidence,
  requireUserPermissions 
} from "./rbac-middleware";
import { getUserPermissions } from "./rbac-seed";
import { db } from "./storage";
import { eq, and } from "drizzle-orm";
import { 
  roles, 
  userRoles, 
  userProjectRoles,
  projects
} from "@shared/schema";

// Configure multer for file upload with disk storage
const upload = multer({ 
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = 'uploads';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Generate unique filename with original extension
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, uniqueSuffix + ext);
    }
  }),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoints
  app.get('/healthz', (req, res) => {
    // Liveness probe - always return 200 if the process is running
    res.status(200).json({ 
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  app.get('/readyz', async (req, res) => {
    // Readiness probe - check if the app is ready to serve traffic
    try {
      const { isDatabaseReady, checkDatabaseConnection } = await import("./db");
      
      // Use the cached readiness state first, fallback to fresh check
      let isDbHealthy = isDatabaseReady();
      
      // If not ready, try a fresh check (but don't wait too long)
      if (!isDbHealthy) {
        isDbHealthy = await checkDatabaseConnection();
      }
      
      if (!isDbHealthy) {
        return res.status(503).json({
          status: 'not ready',
          reason: 'database connection failed',
          timestamp: new Date().toISOString()
        });
      }

      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'healthy'
        }
      });
    } catch (error) {
      console.error('Readiness check failed:', error);
      res.status(503).json({
        status: 'not ready', 
        reason: 'health check error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // DEPRECATED: Old Replit OAuth setup - now using email/password JWT auth
  // await setupAuth(app);

  // Auth routes - new JWT-based authentication
  // The /api/auth/* routes are handled by authRouter (mounted below at line 3100+)

  // Legacy compatibility endpoint - maps to new auth system
  app.get('/api/auth/user', requireAuth, async (req: AuthRequest, res) => {
    try {
      // New auth system stores userId in req.userId (from JWT)
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get user from new auth_users table
      const { authService } = await import("./services/authService");
      const user = await authService.getUserById(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
        profileImageUrl: null, // Not used in new system
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // RBAC routes
  app.get('/api/me/permissions', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId;
      const projectId = req.query.project_id ? parseInt(req.query.project_id as string) : undefined;

      console.log(`[Permissions API] Fetching permissions for user ID: ${userId} (type: ${typeof userId})`);

      // Convert userId to string for database query (users table uses varchar IDs)
      const userIdStr = String(userId);
      const permissions = await getUserPermissions(userIdStr, projectId);

      console.log(`[Permissions API] Found ${permissions.length} permissions:`, permissions);

      res.json({
        permissions,
        projectId
      });
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      res.status(500).json({ message: "Failed to fetch permissions" });
    }
  });

  // User Management routes  
  app.get('/api/users', requireAuth, async (req: AuthRequest, res) => {
    try {
      const currentUser = await storage.getUser(req.userId);
      const users = await storage.getAllUsers(currentUser?.organizationId || undefined);
      
      // Format for workflow components (simplified structure)
      const formattedUsers = users.map(user => ({
        id: user.id,
        email: user.email || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User',
        profilePicture: user.profilePicture || user.profileImageUrl || null
      }));
      
      console.log(`✅ Returning ${formattedUsers.length} users for workflows`);
      res.json(formattedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post('/api/users', requireAuth, requirePermissions(['change_user_permissions']), async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.userId);
      const { id, email, firstName, lastName, organizationId, roleIds } = req.body;
      
      if (!id || !email) {
        return res.status(400).json({ message: "ID and email are required" });
      }

      const newUser = await storage.createUser({
        id,
        email,
        firstName,
        lastName,
        role: 'viewer', // Default role in legacy field
        organizationId: organizationId || currentUser?.organizationId,
      });

      // Assign roles if provided
      if (roleIds && Array.isArray(roleIds) && roleIds.length > 0) {
        for (const roleId of roleIds) {
          await storage.assignUserRole(id, roleId);
        }
      } else {
        // Assign default viewer role if no roles specified
        const allRoles = await storage.getRoles();
        const viewerRole = allRoles.find(r => r.code === 'viewer');
        if (viewerRole) {
          await storage.assignUserRole(id, viewerRole.id);
        }
      }

      // Return user with roles
      const userWithRoles = {
        ...newUser,
        userRoles: await storage.getUserRoles(id)
      };

      res.status(201).json(userWithRoles);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // RBAC API endpoints
  app.get('/api/roles', requireAuth, requirePermissions(['change_user_permissions']), async (req: any, res) => {
    try {
      const roles = await storage.getRoles();
      res.json(roles);
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });

  app.get('/api/permissions', requireAuth, requirePermissions(['change_user_permissions']), async (req: any, res) => {
    try {
      const allPermissions = await storage.getPermissions();
      const allRoles = await storage.getRoles();
      
      // Group permissions by category (aligned with Excel structure)
      const permissionCategories = [
        {
          id: 'org_roles',
          name: 'Organization Roles',
          description: 'System-wide roles that apply across the entire organization',
          permissions: allRoles.map(role => ({
            id: role.id,
            code: role.code,
            name: role.name,
            type: 'role',
            category: 'org_roles'
          }))
        },
        {
          id: 'project_roles', 
          name: 'Project Roles',
          description: 'Project-specific roles that apply to individual projects',
          permissions: allRoles.map(role => ({
            id: role.id,
            code: role.code,
            name: role.name,
            type: 'role',
            category: 'project_roles'
          }))
        },
        {
          id: 'regulation_roles',
          name: 'Regulation Roles', 
          description: 'Specialized roles for regulation management and compliance oversight',
          permissions: allRoles.filter(role => ['officer', 'collaborator'].includes(role.code)).map(role => ({
            id: role.id,
            code: role.code,
            name: role.name,
            type: 'role',
            category: 'regulation_roles'
          }))
        },
        {
          id: 'functional_permissions',
          name: 'Functional Permissions',
          description: 'Granular permissions for specific system functions',
          permissions: allPermissions.map(perm => ({
            id: perm.id,
            code: perm.code,
            name: perm.description || perm.code.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            type: 'permission',
            category: 'functional_permissions'
          }))
        }
      ];
      
      res.json({
        categories: permissionCategories,
        // Keep backward compatibility
        permissions: allPermissions,
        roles: allRoles
      });
    } catch (error) {
      console.error("Error fetching permissions:", error);
      res.status(500).json({ message: "Failed to fetch permissions" });
    }
  });

  app.put('/api/users/:userId/roles', requireAuth, requirePermissions(['change_user_permissions']), async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { roleIds } = req.body;

      if (!Array.isArray(roleIds)) {
        return res.status(400).json({ message: "roleIds must be an array" });
      }

      // Remove all current roles for user
      const currentRoles = await storage.getUserRoles(userId);
      for (const role of currentRoles) {
        await storage.removeUserRole(userId, role.id);
      }

      // Assign new roles
      for (const roleId of roleIds) {
        await storage.assignUserRole(userId, roleId);
      }

      res.json({ message: "User roles updated successfully" });
    } catch (error) {
      console.error("Error updating user roles:", error);
      res.status(500).json({ message: "Failed to update user roles" });
    }
  });

  app.get('/api/users/:userId/effective-permissions', requireAuth, requirePermissions(['change_user_permissions']), async (req: any, res) => {
    try {
      const { userId } = req.params;
      const projectId = req.query.project_id ? parseInt(req.query.project_id) : undefined;
      
      // Get user info
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get organization roles
      const orgRoles = await storage.getUserRoles(userId);
      
      // Get project roles if project context is specified
      let projectRoles: any[] = [];
      let projectContext = null;
      if (projectId) {
        projectRoles = await storage.getUserProjectRoles(userId);
        const projectData = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
        if (projectData.length > 0) {
          projectContext = {
            id: projectData[0].id,
            name: projectData[0].name
          };
        }
      }

      // Get effective permissions
      const permissions = await getUserPermissions(userId, projectId);
      const allPermissions = await storage.getPermissions();

      // Format permissions with descriptions
      const formattedPermissions = permissions.map(permCode => {
        const permDetail = allPermissions.find(p => p.code === permCode);
        return {
          code: permCode,
          description: permDetail?.description || permCode.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          source: projectId ? 'project' : 'organization'
        };
      });

      // Format response to match frontend expectations
      res.json({
        roles: {
          org: orgRoles.map(r => r.code),
          project: projectId ? projectRoles
            .filter(pr => pr.project_id === projectId)
            .flatMap(pr => pr.roles) : []
        },
        permissions: permissions // Just the permission codes array
      });
    } catch (error) {
      console.error("Error fetching user effective permissions:", error);
      res.status(500).json({ message: "Failed to fetch effective permissions" });
    }
  });

  app.get('/api/users/:userId/roles', requireAuth, requirePermissions(['change_user_permissions']), async (req: any, res) => {
    try {
      const { userId } = req.params;
      const roles = await storage.getUserRoles(userId);
      res.json(roles);
    } catch (error) {
      console.error("Error fetching user roles:", error);
      res.status(500).json({ message: "Failed to fetch user roles" });
    }
  });

  // Enhanced RBAC endpoints for admin panel
  app.post('/api/users/:userId/org-roles', requireAuth, requirePermissions(['change_user_permissions']), async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { add = [], remove = [] } = req.body;

      // Remove specified roles
      for (const roleCode of remove) {
        const role = await db.select().from(roles).where(eq(roles.code, roleCode)).limit(1);
        if (role.length > 0) {
          await storage.removeUserRole(userId, role[0].id);
        }
      }

      // Add specified roles
      for (const roleCode of add) {
        const role = await db.select().from(roles).where(eq(roles.code, roleCode)).limit(1);
        if (role.length > 0) {
          await storage.assignUserRole(userId, role[0].id);
        }
      }

      res.json({ message: "Organization roles updated successfully" });
    } catch (error) {
      console.error("Error updating organization roles:", error);
      res.status(500).json({ message: "Failed to update organization roles" });
    }
  });

  app.post('/api/users/:userId/project-roles', requireAuth, requirePermissions(['change_user_permissions']), async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { project_id, add = [], remove = [] } = req.body;

      if (!project_id) {
        return res.status(400).json({ message: "Project ID is required" });
      }

      const projectId = parseInt(project_id);

      // Remove specified project roles
      for (const roleCode of remove) {
        const role = await db.select().from(roles).where(eq(roles.code, roleCode)).limit(1);
        if (role.length > 0) {
          await storage.removeUserProjectRole(userId, projectId, role[0].id);
        }
      }

      // Add specified project roles
      for (const roleCode of add) {
        const role = await db.select().from(roles).where(eq(roles.code, roleCode)).limit(1);
        if (role.length > 0) {
          await storage.assignUserProjectRole(userId, projectId, role[0].id);
        }
      }

      res.json({ message: "Project roles updated successfully" });
    } catch (error) {
      console.error("Error updating project roles:", error);
      res.status(500).json({ message: "Failed to update project roles" });
    }
  });

  app.get('/api/users/:userId/project-roles', requireAuth, requirePermissions(['change_user_permissions']), async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Get user's project roles with project information
      const projectRoles = await db
        .select({
          projectId: userProjectRoles.projectId,
          projectName: projects.name,
          projectNameAr: projects.nameAr,
          roleCode: roles.code,
          roleName: roles.name,
        })
        .from(userProjectRoles)
        .leftJoin(projects, eq(userProjectRoles.projectId, projects.id))
        .leftJoin(roles, eq(userProjectRoles.roleId, roles.id))
        .where(eq(userProjectRoles.userId, userId));

      // Group by project
      const groupedRoles = projectRoles.reduce((acc, pr) => {
        if (!pr.projectId || !pr.roleCode) return acc;
        
        const existing = acc.find(p => p.projectId === pr.projectId);
        if (existing) {
          existing.roles.push(pr.roleCode);
        } else {
          acc.push({
            projectId: pr.projectId,
            projectName: pr.projectName || '',
            projectNameAr: pr.projectNameAr || undefined,
            roles: [pr.roleCode]
          });
        }
        return acc;
      }, [] as Array<{ projectId: number; projectName: string; projectNameAr?: string; roles: string[] }>);

      res.json(groupedRoles);
    } catch (error) {
      console.error("Error fetching user project roles:", error);
      res.status(500).json({ message: "Failed to fetch user project roles" });
    }
  });

  app.get('/api/users/:userId/effective-permissions', requireAuth, requirePermissions(['change_user_permissions']), async (req: any, res) => {
    try {
      const { userId } = req.params;
      const projectId = req.query.project_id ? parseInt(req.query.project_id as string) : undefined;

      // Get user permissions
      const permissions = await getUserPermissions(userId, projectId);
      
      // Get user roles (organization level)
      const userOrgRoles = await storage.getUserRoles(userId);
      
      // Get project roles if projectId provided
      let projectRoleCodes: string[] = [];
      if (projectId) {
        const projectRoles = await db
          .select({ roleCode: roles.code })
          .from(userProjectRoles)
          .leftJoin(roles, eq(userProjectRoles.roleId, roles.id))
          .where(and(
            eq(userProjectRoles.userId, userId),
            eq(userProjectRoles.projectId, projectId)
          ));
        
        projectRoleCodes = projectRoles
          .filter(pr => pr.roleCode)
          .map(pr => pr.roleCode!);
      }

      res.json({
        roles: {
          org: userOrgRoles.map(r => r.code),
          project: projectRoleCodes
        },
        permissions
      });
    } catch (error) {
      console.error("Error fetching effective permissions:", error);
      res.status(500).json({ message: "Failed to fetch effective permissions" });
    }
  });

  // Legacy bulk assign endpoint (keep for backward compatibility)
  app.post('/api/admin/users/bulk-assign', requireAuth, requirePermissions(['change_user_permissions']), async (req: any, res) => {
    try {
      const { user_ids, org_roles, project_roles } = req.body;

      if (!Array.isArray(user_ids) || user_ids.length === 0) {
        return res.status(400).json({ message: "User IDs array is required" });
      }

      for (const userId of user_ids) {
        // Handle organization roles
        if (org_roles?.add) {
          for (const roleCode of org_roles.add) {
            const role = await db.select().from(roles).where(eq(roles.code, roleCode)).limit(1);
            if (role.length > 0) {
              await storage.assignUserRole(userId, role[0].id);
            }
          }
        }
        
        if (org_roles?.remove) {
          for (const roleCode of org_roles.remove) {
            const role = await db.select().from(roles).where(eq(roles.code, roleCode)).limit(1);
            if (role.length > 0) {
              await storage.removeUserRole(userId, role[0].id);
            }
          }
        }

        // Handle project roles
        if (project_roles) {
          const projectId = parseInt(project_roles.project_id);
          
          if (project_roles.add) {
            for (const roleCode of project_roles.add) {
              const role = await db.select().from(roles).where(eq(roles.code, roleCode)).limit(1);
              if (role.length > 0) {
                await storage.assignUserProjectRole(userId, projectId, role[0].id);
              }
            }
          }
          
          if (project_roles.remove) {
            for (const roleCode of project_roles.remove) {
              const role = await db.select().from(roles).where(eq(roles.code, roleCode)).limit(1);
              if (role.length > 0) {
                await storage.removeUserProjectRole(userId, projectId, role[0].id);
              }
            }
          }
        }
      }

      res.json({ message: `Bulk role assignment completed for ${user_ids.length} users` });
    } catch (error) {
      console.error("Error in bulk role assignment:", error);
      res.status(500).json({ message: "Failed to complete bulk role assignment" });
    }
  });

  // New Excel-aligned bulk permission assignment endpoint
  app.post('/api/admin/users/bulk-assign-permissions', requireAuth, requirePermissions(['change_user_permissions']), async (req: any, res) => {
    try {
      const { user_ids, operation, categories } = req.body;

      if (!Array.isArray(user_ids) || user_ids.length === 0) {
        return res.status(400).json({ message: "User IDs array is required" });
      }

      if (!operation || !['add', 'remove'].includes(operation)) {
        return res.status(400).json({ message: "Operation must be 'add' or 'remove'" });
      }

      if (!categories || typeof categories !== 'object') {
        return res.status(400).json({ message: "Categories object is required" });
      }

      let operationsCompleted = 0;

      for (const userId of user_ids) {
        for (const [categoryId, categoryData] of Object.entries(categories)) {
          const { type, permissions, project_id } = categoryData as any;

          if (!permissions || !Array.isArray(permissions)) continue;

          for (const permissionCode of permissions) {
            try {
              const role = await db.select().from(roles).where(eq(roles.code, permissionCode)).limit(1);
              if (role.length === 0) continue;

              const roleId = role[0].id;

              if (type === 'project_role' && project_id) {
                // Handle project-specific roles
                const projectIdNum = parseInt(project_id);
                if (operation === 'add') {
                  await storage.assignUserProjectRole(userId, projectIdNum, roleId);
                } else {
                  await storage.removeUserProjectRole(userId, projectIdNum, roleId);
                }
              } else {
                // Handle organization roles
                if (operation === 'add') {
                  await storage.assignUserRole(userId, roleId);
                } else {
                  await storage.removeUserRole(userId, roleId);
                }
              }
              operationsCompleted++;
            } catch (roleError) {
              console.warn(`Failed to ${operation} role ${permissionCode} for user ${userId}:`, roleError);
            }
          }
        }
      }

      res.json({ 
        message: `Bulk permission assignment completed for ${user_ids.length} users`,
        operations_completed: operationsCompleted,
        operation,
        categories_processed: Object.keys(categories)
      });
    } catch (error) {
      console.error("Error in bulk permission assignment:", error);
      res.status(500).json({ message: "Failed to complete bulk permission assignment" });
    }
  });

  // Enhanced admin users endpoint with filtering and pagination
  app.get('/api/admin/users', requireAuth, requirePermissions(['change_user_permissions']), async (req: any, res) => {
    try {
      const { 
        query = '',
        role = '',
        status = '',
        project_id = '',
        page = '1',
        page_size = '20',
        sort_by = 'name',
        sort_order = 'asc'
      } = req.query;

      const pageNum = parseInt(page);
      const pageSizeNum = parseInt(page_size);
      const offset = (pageNum - 1) * pageSizeNum;

      // Get all users with their roles
      const allUsers = await storage.getAllUsers();
      
      // Add user roles to each user
      const usersWithRoles = await Promise.all(
        allUsers.map(async (user) => {
          const userRoles = await storage.getUserRoles(user.id);
          return {
            ...user,
            userRoles,
            status: user.role === 'disabled' ? 'disabled' : 'active', // Mock status from role field
            lastActiveAt: user.updatedAt, // Mock last active from updatedAt
          };
        })
      );

      // Apply filters
      let filteredUsers = usersWithRoles;

      if (query) {
        const searchLower = query.toLowerCase();
        filteredUsers = filteredUsers.filter(user => 
          user.email?.toLowerCase().includes(searchLower) ||
          user.firstName?.toLowerCase().includes(searchLower) ||
          user.lastName?.toLowerCase().includes(searchLower) ||
          user.name?.toLowerCase().includes(searchLower)
        );
      }

      if (role && role !== 'all') {
        filteredUsers = filteredUsers.filter(user => 
          user.userRoles?.some(r => r.code === role)
        );
      }

      if (status && status !== 'all') {
        filteredUsers = filteredUsers.filter(user => user.status === status);
      }

      // Apply sorting
      filteredUsers.sort((a, b) => {
        let aVal: any, bVal: any;
        
        if (sort_by === 'name') {
          aVal = a.firstName && a.lastName ? `${a.firstName} ${a.lastName}` : a.name || a.email || '';
          bVal = b.firstName && b.lastName ? `${b.firstName} ${b.lastName}` : b.name || b.email || '';
        } else if (sort_by === 'lastActive') {
          aVal = new Date(a.lastActiveAt || a.updatedAt || new Date()).getTime();
          bVal = new Date(b.lastActiveAt || b.updatedAt || new Date()).getTime();
        } else {
          return 0;
        }
        
        if (sort_order === 'desc') {
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        } else {
          return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        }
      });

      // Apply pagination
      const total = filteredUsers.length;
      const paginatedUsers = filteredUsers.slice(offset, offset + pageSizeNum);

      res.json({
        users: paginatedUsers,
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages: Math.ceil(total / pageSizeNum),
      });
    } catch (error) {
      console.error("Error fetching admin users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch('/api/users/:userId', requireAuth, requirePermissions(['change_user_permissions']), async (req: any, res) => {
    try {
      const { userId } = req.params;
      const updates = req.body;

      const updatedUser = await storage.updateUser(userId, updates);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Profile picture upload route
  app.post('/api/users/:userId/profile-picture', requireAuth, upload.single('profilePicture'), async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.userId);
      
      // Only admins can update user profile pictures
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin role required." });
      }

      const { userId } = req.params;
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // For memory storage, save to temp location if needed
      const fileExtension = path.extname(req.file.originalname);
      const fileName = `profile_${userId}_${Date.now()}${fileExtension}`;
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const filePath = path.join(uploadsDir, fileName);
      
      // Write buffer to file
      fs.writeFileSync(filePath, req.file.buffer);
      
      // Create URL for the uploaded file
      const profileImageUrl = `/uploads/${fileName}`;
      
      // Update user with new profile image URL
      const updatedUser = await storage.updateUser(userId, { profileImageUrl });
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      res.status(500).json({ message: "Failed to upload profile picture" });
    }
  });

  app.delete('/api/users/:userId', requireAuth, requirePermissions(['change_user_permissions']), async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.userId);
      const { userId } = req.params;
      
      // Prevent self-deletion
      if (userId === currentUser?.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      await storage.deleteUser(userId);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Note: User invitation functionality has been moved to server/routes/users.ts

  // Test email endpoint - for debugging email service
  app.post('/api/admin/test-email', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { email } = req.body;
      const currentUser = { id: req.userId, email: req.userEmail };
      
      if (!email) {
        return res.status(400).json({ message: 'Email address is required' });
      }

      // Auto-detect the base URL
      const baseUrl = process.env.BASE_URL || 
                     (process.env.REPLIT_CLUSTER ? `https://${process.env.REPL_SLUG}.${process.env.REPLIT_CLUSTER}.replit.app` : 'http://localhost:5000');

      await emailService.sendInvitationEmail(
        email,
        currentUser?.email?.split('@')[0] || 'Test Admin',
        'Ambersand Compliance (Test)',
        'This is a test email to verify the email service is working correctly.',
        `${baseUrl}/test-invite`
      );

      res.json({ 
        message: `Test email sent successfully to ${email}`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Test email failed:", error);
      res.status(500).json({ 
        message: "Failed to send test email",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Dashboard metrics
  app.get('/api/dashboard/metrics', requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.userId);
      const metrics = await storage.getDashboardMetrics(user?.organizationId || undefined);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  // Dynamic dashboard regulations
  app.get('/api/dashboard/regulations', requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.userId);
      console.log('🔍 Dashboard regulations debug:');
      console.log('  - User ID:', req.userId);
      console.log('  - User found:', user ? 'yes' : 'no');
      console.log('  - User organizationId:', user?.organizationId);

      const regulations = await storage.getDynamicRegulations(user?.organizationId || undefined);
      console.log('  - Regulations returned:', regulations.length);

      res.json(regulations);
    } catch (error) {
      console.error("Error fetching dashboard regulations:", error);
      res.status(500).json({ message: "Failed to fetch dashboard regulations" });
    }
  });

  // Projects routes
  app.get('/api/projects', requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.userId);
      const projects = await storage.getProjects(user?.organizationId || undefined);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get('/api/projects/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.post('/api/projects', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId;
      console.log("Creating project for user:", userId);
      console.log("Request body:", JSON.stringify(req.body, null, 2));
      
      const user = await storage.getUser(userId);
      console.log("User found:", user ? "yes" : "no");
      
      // Extract controlIds, regulationType, and regulationId from the request body
      const { controlIds, regulationType, regulationId, ...projectBody } = req.body;
      console.log("Extracted controlIds:", controlIds);
      console.log("Regulation type:", regulationType);
      console.log("Regulation ID:", regulationId);
      console.log("Project body:", projectBody);
      
      const projectData = insertProjectSchema.parse({
        ...projectBody,
        ownerId: String(userId), // Convert to string to match varchar schema
        organizationId: user?.organizationId,
        regulationType: regulationType, // Legacy field
        regulationId: regulationId, // New field for regulation association
      });
      console.log("Parsed project data:", projectData);
      
      const project = await storage.createProject(projectData);
      console.log("Project created with ID:", project.id);
      
      // Add controls to the project if provided
      if (controlIds && Array.isArray(controlIds) && controlIds.length > 0) {
        const source: 'ecc'|'custom' = regulationType === 'custom' ? 'custom' : 'ecc';
        console.log("Adding", controlIds.length, "controls to project with source:", source);
        await storage.addControlsToProjectBySource(project.id, controlIds, source);
        console.log("Controls added successfully");
      }
      
      res.status(201).json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack available');
      res.status(500).json({ 
        message: "Failed to create project",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.put('/api/projects/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const projectData = req.body;
      const project = await storage.updateProject(id, projectData);
      res.json(project);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  app.delete('/api/projects/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteProject(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // Project Controls routes
  app.get('/api/projects/:id/controls', requireAuth, async (req: AuthRequest, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const controls = await storage.getProjectControls(projectId);
      res.json(controls);
    } catch (error) {
      console.error("Error fetching project controls:", error);
      res.status(500).json({ message: "Failed to fetch project controls" });
    }
  });

  app.post('/api/projects/:id/controls', requireAuth, async (req: AuthRequest, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const { controlIds } = req.body;
      
      if (!Array.isArray(controlIds)) {
        return res.status(400).json({ message: "controlIds must be an array" });
      }

      await storage.addControlsToProject(projectId, controlIds);
      res.status(201).json({ message: "Controls added to project successfully" });
    } catch (error) {
      console.error("Error adding controls to project:", error);
      res.status(500).json({ message: "Failed to add controls to project" });
    }
  });

  app.delete('/api/projects/:projectId/controls/:controlId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const controlId = parseInt(req.params.controlId);
      
      await storage.removeControlFromProject(projectId, controlId);
      res.json({ message: "Control removed from project successfully" });
    } catch (error) {
      console.error("Error removing control from project:", error);
      res.status(500).json({ message: "Failed to remove control from project" });
    }
  });

  // Debug endpoint to check what routes are registered
  app.get('/api/debug-routes', (req, res) => {
    res.json({ message: 'Routes endpoint working', timestamp: new Date().toISOString() });
  });

  // Direct email test endpoint
  app.post('/api/debug-send-email', requireAuth, async (req: AuthRequest, res) => {
    try {
      console.log('🚀 DEBUG EMAIL ENDPOINT HIT');
      // emailService is already imported and available
      
      const user = await storage.getUser(req.userId);
      if (!user || !user.email) {
        return res.status(400).json({ error: 'User not found or no email' });
      }
      
      const result = await emailService.sendTaskAssignmentEmail(
        user.email,
        user.firstName || user.name || 'User',
        'Debug Test Task',
        '2025-08-30',
        'Debug Project',
        'en',
        999
      );
      
      res.json({ success: result.success, error: result.error });
    } catch (error) {
      console.error('Debug email error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Debugging middleware to log ALL requests
  app.use('/api/tasks*', (req, res, next) => {
    console.log('\n🌟🌟🌟 MIDDLEWARE: Request to tasks endpoint detected');
    console.log('🌟 URL:', req.url);
    console.log('🌟 Method:', req.method);
    console.log('🌟 Headers:', req.headers);
    console.log('🌟 Body:', req.body);
    console.log('🌟 User:', (req as any).user);
    next();
  });

  // Tasks routes
  app.get('/api/tasks', requireAuth, async (req, res) => {
    try {
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
      const assigneeId = req.query.assigneeId as string | undefined;
      const tasks = await storage.getTasks(projectId, assigneeId);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.get('/api/tasks/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const task = await storage.getTask(id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error("Error fetching task:", error);
      res.status(500).json({ message: "Failed to fetch task" });
    }
  });

  app.post('/api/tasks', requireAuth, async (req: AuthRequest, res) => {
    console.log('\n🔥🔥🔥🔥🔥🔥🔥🔥🔥 TASK CREATION ROUTE HIT 🔥🔥🔥🔥🔥🔥🔥🔥🔥');
    console.log('🔥🔥🔥 ROUTES: POST /api/tasks called with body:', JSON.stringify(req.body, null, 2));
    console.log('🔥🔥🔥 ROUTES: User auth debug:', {
      userId: req.userId,
      userEmail: req.userEmail,
      userRole: req.userRole,
      organizationId: req.organizationId
    });
    console.log('🔥🔥🔥 ROUTES: URL requested:', req.url);
    console.log('🔥🔥🔥 ROUTES: Method:', req.method);
    console.log('🔥🔥🔥🔥🔥🔥🔥🔥🔥 ROUTE PROCESSING STARTING 🔥🔥🔥🔥🔥🔥🔥🔥🔥');
    try {
      // Get current user from database to ensure we have organizationId
      const currentUserId = req.userId;
      if (!currentUserId) {
        return res.status(401).json({ message: "User ID not found in request" });
      }
      
      const currentUserResult = await db.select({
        id: users.id,
        email: users.email,
        organizationId: users.organizationId,
        firstName: users.firstName,
        lastName: users.lastName
      })
      .from(users)
      .where(eq(users.id, String(currentUserId)))
      .limit(1);

      if (currentUserResult.length === 0) {
        return res.status(401).json({ message: "User not found in database" });
      }

      const currentUser = currentUserResult[0];
      console.log('🔍 Current user from database:', currentUser);

      // Parse and validate request body per specification
      const body = z.object({
        title: z.string().min(1),
        titleAr: z.string().optional(),
        description: z.string().optional(),
        descriptionAr: z.string().optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
        dueDate: z.string().optional(),
        assigneeId: z.string().optional(),        // string per spec
        assigneeEmail: z.string().email().optional(),
        projectId: z.number(),
        controlIds: z.array(z.number()).min(1),
        createSeparateTasks: z.boolean().default(false),
      }).parse(req.body);

      // Logic per specification
      let assigneeId: string | null = null;
      let pendingAssigneeInviteId: number | null = null;

      if (body.assigneeId) {
        // Validate user belongs to same org (or both have null org for admin users)
        const orgId = currentUser.organizationId;
        const whereCondition = orgId 
          ? and(eq(users.id, body.assigneeId), eq(users.organizationId, orgId))
          : eq(users.id, body.assigneeId); // For admin users with no org, just check user exists
        
        const u = await db.select({ id: users.id })
          .from(users)
          .where(whereCondition)
          .limit(1);
        
        if (u.length > 0) assigneeId = u[0].id;
      } else if (body.assigneeEmail) {
        const normalized = body.assigneeEmail.toLowerCase().trim();

        // Try existing user first (handle null org for admin users)
        const orgId = currentUser.organizationId;
        const whereCondition = orgId 
          ? and(eq(users.organizationId, orgId), eq(users.email, normalized))
          : eq(users.email, normalized); // For admin users with no org
        
        const u = await db.select({ id: users.id })
          .from(users)
          .where(whereCondition)
          .limit(1);
        
        if (u.length > 0) {
          assigneeId = u[0].id;
        } else {
          // Create invite per specification
          const orgId = currentUser.organizationId || 'default';

          // Debug: Log user context
          console.log('🔍 DEBUG - Database user for invitation:', currentUser);
          console.log('🔍 DEBUG - Organization ID found:', orgId);
          
          const token = crypto.randomUUID().replace(/-/g, "");
          const [invite] = await db.insert(userInvites).values({
            organizationId: orgId,
            email: normalized,
            role: "member",
            token,
          }).returning();
          
          pendingAssigneeInviteId = invite.id;

          const acceptUrl = `${process.env.APP_BASE_URL || "http://localhost:5000"}/accept-invite?token=${token}`;

          // Get inviter information
          const inviterName = currentUser.firstName && currentUser.lastName
            ? `${currentUser.firstName} ${currentUser.lastName}`
            : (currentUser.email?.split('@')[0] || 'Team Member');

          // Get organization name (fallback to 'Ambersand Compliance' if not available)
          const organizationName = 'Ambersand Compliance'; // TODO: Get from organization table when available

          // Use proper invitation email with template
          console.log(`📧 Attempting to send invitation email to ${normalized}`);
          const emailResult = await emailService.sendInvitationEmail(
            normalized,
            inviterName,
            organizationName,
            `You've been assigned a task titled "${body.title}". Please accept this invitation to view and complete it.`,
            acceptUrl
          );

          if (!emailResult.success) {
            console.error(`❌ Failed to send invitation email: ${emailResult.error}`);
            // Delete the invite we just created since email cannot be sent
            await db.delete(userInvites).where(eq(userInvites.id, invite.id));
            return res.status(500).json({
              message: "Failed to send invitation email. Email service not configured properly.",
              error: emailResult.error,
              details: "Please ensure SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, and APP_BASE_URL are set in environment variables."
            });
          }

          console.log(`✅ Invitation email sent successfully to ${normalized} from ${inviterName} (${organizationName})`);
        }
      }

      const taskData = insertTaskSchema.parse({
        title: body.title,
        titleAr: body.titleAr,
        description: body.description,
        descriptionAr: body.descriptionAr,
        priority: body.priority,
        dueDate: body.dueDate || null,
        projectId: body.projectId,
        assigneeId,
        pendingAssigneeInviteId,
        createdById: currentUser.id,
      });
      
      console.log('🔥🔥🔥 Parsed task data:', JSON.stringify(taskData, null, 2));
      const task = await storage.createTask(taskData);
      console.log('🔥🔥🔥 Task created successfully:', JSON.stringify(task, null, 2));

      // Create task-control relationships
      if (body.controlIds.length > 0) {
        await storage.addControlsToTask(task.id, body.controlIds);
      }

      // Email notification is handled by storage.createTask() method for existing users
      // For pending invites, send task assignment email here
      console.log(`🔍 DEBUG - Checking if task assignment email should be sent:`, {
        hasPendingAssigneeInviteId: !!task.pendingAssigneeInviteId,
        pendingAssigneeInviteIdValue: task.pendingAssigneeInviteId,
        hasAssigneeEmail: !!body.assigneeEmail,
        assigneeEmailValue: body.assigneeEmail,
        willSendEmail: !!(task.pendingAssigneeInviteId && body.assigneeEmail)
      });

      if (task.pendingAssigneeInviteId && body.assigneeEmail) {
        const project = task.projectId ? await storage.getProject(task.projectId) : null;
        const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Not set';
        const projectName = project?.name || 'Untitled Project';
        const userName = body.assigneeEmail.split('@')[0]; // Use email prefix as name for new users

        console.log(`📧 Attempting to send task assignment email to pending invite: ${body.assigneeEmail}`);
        const taskEmailResult = await emailService.sendTaskAssignmentEmail(
          body.assigneeEmail,
          userName,
          task.title,
          dueDate,
          projectName,
          'en',
          task.id
        );

        if (taskEmailResult.success) {
          console.log(`✅ Task assignment email sent successfully to pending invite: ${body.assigneeEmail}`);
        } else {
          console.error(`❌ Failed to send task assignment email: ${taskEmailResult.error}`);
          // Note: We don't fail the request here since the invite was already sent and task created
        }
      } else {
        console.log(`ℹ️  Skipping task assignment email - either no pending invite or no assignee email`);
      }

      res.status(201).json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  app.put('/api/tasks/:id', requireAuth, async (req, res) => {
    try {
      console.log('PUT /api/tasks/:id called with:', { id: req.params.id, body: req.body });
      const id = parseInt(req.params.id);
      const taskData = insertTaskSchema.partial().parse(req.body);
      console.log('Parsed task data:', taskData);
      
      // Get the old task for status comparison
      const oldTask = await storage.getTask(id);
      const task = await storage.updateTask(id, taskData);
      console.log('Task updated successfully:', task);
      
      // Send email notifications for status changes and new assignments
      try {
        // Check for status update
        if (oldTask && taskData.status && oldTask.status !== taskData.status && task.assigneeId) {
          const assignedUser = await storage.getUser(task.assigneeId);
          if (assignedUser && assignedUser.email) {
            await emailService.sendStatusUpdateEmail(
              assignedUser.email,
              assignedUser.firstName || assignedUser.name || 'User',
              task.title,
              oldTask.status,
              taskData.status,
              (assignedUser.language as 'en' | 'ar') || 'en',
              task.id
            );
            
            console.log(`Task status update email sent to ${assignedUser.email}`);
          }
        }
        
        // Check for new assignment (including self-assignment)
        console.log('📧 Assignment check:', { 
          newAssigneeId: taskData.assigneeId, 
          oldAssigneeId: oldTask?.assigneeId,
          currentUserId: req.userId,
          isNewAssignment: taskData.assigneeId && oldTask?.assigneeId !== taskData.assigneeId
        });
        
        if (taskData.assigneeId && oldTask?.assigneeId !== taskData.assigneeId) {
          console.log('📧 Attempting to send task reassignment email...');
          const assignedUser = await storage.getUser(taskData.assigneeId);
          const project = task.projectId ? await storage.getProject(task.projectId) : null;
          
          if (assignedUser && assignedUser.email) {
            const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Not set';
            const projectName = project?.name || 'Untitled Project';
            await emailService.sendTaskAssignmentEmail(
              assignedUser.email,
              assignedUser.firstName || assignedUser.name || 'User',
              task.title,
              dueDate,
              projectName,
              (assignedUser.language as 'en' | 'ar') || 'en',
              task.id
            );
            
            console.log(`✅ Task reassignment email sent successfully to ${assignedUser.email}`);
          } else {
            console.log('❌ No reassignment email sent: Missing assigned user or email address');
          }
        }
      } catch (emailError) {
        console.error('Failed to send task update email:', emailError);
      }
      
      res.json(task);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  app.delete('/api/tasks/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTask(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  // Task Controls routes
  app.get('/api/tasks/:id/controls', requireAuth, async (req, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const controls = await storage.getTaskControls(taskId);
      console.log('📋 Task controls for task', taskId, ':', JSON.stringify(controls, null, 2));
      res.json(controls);
    } catch (error) {
      console.error("Error fetching task controls:", error);
      res.status(500).json({ message: "Failed to fetch task controls" });
    }
  });

  // Get all task controls for displaying badges
  app.get('/api/tasks/controls/all', requireAuth, async (req, res) => {
    try {
      const tasks = await storage.getTasks();
      const taskControlsMap: Record<number, any[]> = {};
      
      for (const task of tasks) {
        const controls = await storage.getTaskControls(task.id);
        taskControlsMap[task.id] = controls;
      }
      
      res.json(taskControlsMap);
    } catch (error) {
      console.error("Error fetching all task controls:", error);
      res.status(500).json({ message: "Failed to fetch all task controls" });
    }
  });

  // Get evidence for a specific task
  app.get('/api/evidence/task/:taskId', requireAuth, async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const evidence = await storage.getEvidenceByTaskId(taskId);
      res.json(evidence);
    } catch (error) {
      console.error("Error fetching task evidence:", error);
      res.status(500).json({ message: "Failed to fetch task evidence" });
    }
  });

  app.post('/api/tasks/:id/controls', requireAuth, async (req, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const { controlIds } = req.body;
      
      if (!Array.isArray(controlIds)) {
        return res.status(400).json({ message: "controlIds must be an array" });
      }
      
      await storage.addControlsToTask(taskId, controlIds);
      res.status(201).json({ message: "Controls added to task successfully" });
    } catch (error) {
      console.error("Error adding controls to task:", error);
      res.status(500).json({ message: "Failed to add controls to task" });
    }
  });

  app.delete('/api/tasks/:id/controls', requireAuth, async (req, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const { controlIds } = req.body;

      if (!Array.isArray(controlIds)) {
        return res.status(400).json({ message: "controlIds must be an array" });
      }

      await storage.removeControlsFromTask(taskId, controlIds);
      res.json({ message: "Controls removed from task successfully" });
    } catch (error) {
      console.error("Error removing controls from task:", error);
      res.status(500).json({ message: "Failed to remove controls from task" });
    }
  });

  // Get active tasks for specific controls - for duplicate prevention
  app.post('/api/controls/active-tasks', requireAuth, async (req, res) => {
    try {
      const { controlIds, projectId } = req.body;

      if (!Array.isArray(controlIds)) {
        return res.status(400).json({ message: "controlIds must be an array" });
      }

      if (typeof projectId !== 'number') {
        return res.status(400).json({ message: "projectId must be a number" });
      }

      // Get all tasks for the project
      const projectTasks = await storage.getTasks(projectId);

      // Filter to only active tasks (not completed or blocked permanently)
      const activeTasks = projectTasks.filter((task: any) =>
        task.status !== 'completed' && task.status !== 'blocked'
      );

      // For each control, find tasks that reference it
      const controlTasksMap: Record<number, any[]> = {};

      for (const controlId of controlIds) {
        const tasksForControl = [];

        for (const task of activeTasks) {
          try {
            const taskControls = await storage.getTaskControls(task.id);
            const hasControl = taskControls.some((tc: any) =>
              (tc.eccControl?.id === controlId) || (tc.customControl?.id === controlId)
            );

            if (hasControl) {
              tasksForControl.push({
                id: task.id,
                title: task.title,
                titleAr: task.titleAr,
                status: task.status,
                priority: task.priority,
                dueDate: task.dueDate,
                assigneeId: task.assigneeId,
                createdAt: task.createdAt
              });
            }
          } catch (error) {
            console.error(`Error getting controls for task ${task.id}:`, error);
          }
        }

        controlTasksMap[controlId] = tasksForControl;
      }

      res.json(controlTasksMap);
    } catch (error) {
      console.error("Error fetching active tasks for controls:", error);
      res.status(500).json({ message: "Failed to fetch active tasks for controls" });
    }
  });

  // ECC Controls routes - Updated to use new regulations system
  app.get('/api/ecc-controls', requireAuth, async (req, res) => {
    try {
      const search = req.query.search as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
      
      // Import the necessary modules
      const { regulations, regulationControls } = await import('../shared/schema');
      const { db } = await import('./db');
      const { eq, and, or, like, asc, count } = await import('drizzle-orm');
      
      // Define where conditions
      let whereConditions;
      if (search) {
        whereConditions = and(
          eq(regulations.code, 'NCA-ECC-2024'),
          or(
            like(regulationControls.clause, `%${search}%`),
            like(regulationControls.mainCategoryEn, `%${search}%`),
            like(regulationControls.mainCategoryAr, `%${search}%`),
            like(regulationControls.subCategoryEn, `%${search}%`),
            like(regulationControls.subCategoryAr, `%${search}%`),
            like(regulationControls.mainControlEn, `%${search}%`),
            like(regulationControls.mainControlAr, `%${search}%`),
            like(regulationControls.descriptionEn, `%${search}%`),
            like(regulationControls.descriptionAr, `%${search}%`)
          )
        );
      } else {
        whereConditions = eq(regulations.code, 'NCA-ECC-2024');
      }

      // Common select fields
      const selectFields = {
        id: regulationControls.id,
        code: regulationControls.clause,
        codeAr: regulationControls.clause, // Using same clause for both
        domainEn: regulationControls.mainCategoryEn,
        domainAr: regulationControls.mainCategoryAr,
        subdomainEn: regulationControls.subCategoryEn,
        subdomainAr: regulationControls.subCategoryAr,
        controlEn: regulationControls.mainControlEn,
        controlAr: regulationControls.mainControlAr,
        titleEn: regulationControls.mainControlEn, // Map to main control
        titleAr: regulationControls.mainControlAr, // Map to main control
        implementationGuidanceEn: regulationControls.descriptionEn,
        implementationGuidanceAr: regulationControls.descriptionAr,
        evidenceEn: regulationControls.evidenceTypes,
        evidenceAr: regulationControls.evidenceTypes,
        evidenceRequiredEn: regulationControls.evidenceTypes,
        evidenceRequiredAr: regulationControls.evidenceTypes,
        requirementEn: regulationControls.descriptionEn,
        requirementAr: regulationControls.descriptionAr,
        weight: regulationControls.weight,
        createdAt: regulationControls.createdAt,
      };

      // Build query based on pagination requirements
      let finalQuery;
      if (limit !== undefined) {
        if (offset > 0) {
          finalQuery = db.select(selectFields)
            .from(regulationControls)
            .innerJoin(regulations, eq(regulationControls.regulationId, regulations.id))
            .where(whereConditions)
            .orderBy(asc(regulationControls.clause))
            .limit(limit)
            .offset(offset);
        } else {
          finalQuery = db.select(selectFields)
            .from(regulationControls)
            .innerJoin(regulations, eq(regulationControls.regulationId, regulations.id))
            .where(whereConditions)
            .orderBy(asc(regulationControls.clause))
            .limit(limit);
        }
      } else if (offset > 0) {
        finalQuery = db.select(selectFields)
          .from(regulationControls)
          .innerJoin(regulations, eq(regulationControls.regulationId, regulations.id))
          .where(whereConditions)
          .orderBy(asc(regulationControls.clause))
          .offset(offset);
      } else {
        finalQuery = db.select(selectFields)
          .from(regulationControls)
          .innerJoin(regulations, eq(regulationControls.regulationId, regulations.id))
          .where(whereConditions)
          .orderBy(asc(regulationControls.clause));
      }

      // Get total count for pagination
      const countResult = await db.select({ count: count() })
        .from(regulationControls)
        .innerJoin(regulations, eq(regulationControls.regulationId, regulations.id))
        .where(whereConditions);

      // Execute the main query
      const items = await finalQuery;
      const total = countResult[0]?.count || 0;

      // Return in the expected format
      if (limit !== undefined) {
        res.json({ items, total });
      } else {
        // For backward compatibility, return just the items array when no pagination
        res.json(items);
      }
    } catch (error) {
      console.error("Error fetching ECC controls:", error);
      res.status(500).json({ message: "Failed to fetch ECC controls" });
    }
  });

  app.get('/api/ecc-controls/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const control = await storage.getEccControl(id);
      if (!control) {
        return res.status(404).json({ message: "ECC control not found" });
      }
      res.json(control);
    } catch (error) {
      console.error("Error fetching ECC control:", error);
      res.status(500).json({ message: "Failed to fetch ECC control" });
    }
  });

  // Regulations summary endpoint for Library page
  app.get('/api/regulations/summary', requireAuth, async (req, res) => {
    try {
      // Import the necessary modules
      const { regulations, regulationControls } = await import('../shared/schema');
      const { db } = await import('./db');
      const { count, eq, asc } = await import('drizzle-orm');
      
      // Get regulations with their control counts
      const regulationsWithCounts = await db.select({
        id: regulations.id,
        code: regulations.code,
        nameEn: regulations.nameEn,
        nameAr: regulations.nameAr,
        version: regulations.version,
        status: regulations.status,
        totalControls: count(regulationControls.id)
      })
      .from(regulations)
      .leftJoin(regulationControls, eq(regulationControls.regulationId, regulations.id))
      .groupBy(
        regulations.id,
        regulations.code,
        regulations.nameEn,
        regulations.nameAr,
        regulations.version,
        regulations.status
      )
      .orderBy(asc(regulations.code));

      res.json(regulationsWithCounts);
    } catch (error) {
      console.error("Error fetching regulations summary:", error);
      res.status(500).json({ message: "Failed to fetch regulations summary" });
    }
  });

  // Get controls for a specific regulation
  app.get('/api/regulations/:id/controls', requireAuth, async (req, res) => {
    try {
      const regulationId = parseInt(req.params.id);
      if (isNaN(regulationId)) {
        return res.status(400).json({ message: "Invalid regulation ID" });
      }

      // Import the necessary modules
      const { regulations, regulationControls } = await import('../shared/schema');
      const { db } = await import('./db');
      const { eq, asc } = await import('drizzle-orm');
      
      // First check if regulation exists
      const regulation = await db.query.regulations.findFirst({
        where: eq(regulations.id, regulationId)
      });
      
      if (!regulation) {
        return res.status(404).json({ message: "Regulation not found" });
      }
      
      // Get all controls for this regulation with camelCase fields
      const controls = await db.select({
        id: regulationControls.id,
        clauseNumber: regulationControls.clause,
        domainEn: regulationControls.mainCategoryEn,
        domainAr: regulationControls.mainCategoryAr,
        subdomainEn: regulationControls.subCategoryEn,
        subdomainAr: regulationControls.subCategoryAr,
        controlEn: regulationControls.mainControlEn,
        controlAr: regulationControls.mainControlAr,
        descriptionEn: regulationControls.descriptionEn,
        descriptionAr: regulationControls.descriptionAr,
        evidenceTypes: regulationControls.evidenceTypes,
        weight: regulationControls.weight
      })
      .from(regulationControls)
      .where(eq(regulationControls.regulationId, regulationId))
      .orderBy(asc(regulationControls.clause));

      res.json(controls);
    } catch (error) {
      console.error("Error fetching regulation controls:", error);
      res.status(500).json({ message: "Failed to fetch regulation controls" });
    }
  });

  // Evidence routes
  app.get('/api/evidence', requireAuth, async (req, res) => {
    try {
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
      const taskId = req.query.taskId ? parseInt(req.query.taskId as string) : undefined;
      console.log('Evidence query - projectId:', projectId, 'taskId:', taskId);
      const evidence = await storage.getEvidence(projectId);
      console.log('Evidence query result:', evidence.length, 'items found');
      res.json(evidence);
    } catch (error) {
      console.error("Error fetching evidence:", error);
      res.status(500).json({ message: "Failed to fetch evidence" });
    }
  });

  app.post('/api/evidence', requireAuth, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const taskId = req.body.taskId ? parseInt(req.body.taskId) : undefined;
      const projectId = req.body.projectId ? parseInt(req.body.projectId) : undefined;

      const evidenceData = insertEvidenceSchema.parse({
        title: req.body.title,
        titleAr: req.body.titleAr,
        description: req.body.description,
        descriptionAr: req.body.descriptionAr,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        filePath: req.file.path,
        taskId: taskId,
        projectId: projectId,
        uploadedById: req.userId,
      });
      
      const evidence = await storage.createEvidence(evidenceData);

      // If this evidence is for a task, link it to the relevant project regulation controls
      if (taskId && projectId) {
        try {
          // Get task regulation controls to find which controls this evidence should be linked to
          const taskControls = await db.select({ controlId: taskRegulationControls.controlId })
            .from(taskRegulationControls)
            .where(eq(taskRegulationControls.taskId, taskId));

          for (const trc of taskControls) {
            // Find the project regulation control ID
            const projectRegulationControl = await db.select({ id: projectRegulationControls.id })
              .from(projectRegulationControls)
              .where(and(
                eq(projectRegulationControls.projectId, projectId),
                eq(projectRegulationControls.controlId, trc.controlId)
              ))
              .limit(1);

            if (projectRegulationControl.length > 0) {
              // Link evidence to the modern regulation controls system
              await storage.linkEvidenceToControl(evidence.id, projectRegulationControl[0].id);
              console.log(`🔗 Linked evidence ${evidence.id} to project regulation control ${projectRegulationControl[0].id}`);
            }
          }
        } catch (linkError) {
          console.log('⚠️ Could not link evidence to regulation controls:', linkError);
        }
      }

      res.status(201).json(evidence);
    } catch (error) {
      console.error("Error uploading evidence:", error);
      res.status(500).json({ message: "Failed to upload evidence" });
    }
  });

  // Delete ALL evidence from the system using query parameter approach
  app.delete('/api/evidence', requireAuth, async (req, res) => {
    // Check if this is a delete all request
    if (req.query.deleteAll === 'true') {
      try {
        console.log('🗑️ Starting complete evidence deletion process...');

        // First, get all evidence files directly from database to know what files to delete
        const allEvidence = await db.select().from(evidence);
        console.log(`📋 Found ${allEvidence.length} evidence files to delete`);

        if (allEvidence.length === 0) {
          return res.json({ message: "No evidence found to delete", deletedCount: 0 });
        }

        // Get file paths for cleanup
        const filePaths = allEvidence.map(e => e.filePath);
        
        // Delete from related tables first (foreign key constraints)
        console.log('🔗 Deleting evidence-control links...');
        await db.delete(evidenceControls);
        
        console.log('🔗 Deleting evidence-task links...');
        await db.delete(evidenceTasks);
        
        console.log('💬 Deleting evidence comments...');
        await db.delete(evidenceComments);
        
        console.log('📝 Deleting evidence versions...');
        await db.delete(evidenceVersions);
        
        // Finally, delete the main evidence records
        console.log('📄 Deleting main evidence records...');
        await db.delete(evidence);

        // Clean up actual files from filesystem
        let filesDeleted = 0;
        let filesNotFound = 0;
        
        for (const filePath of filePaths) {
          try {
            const fs = await import('fs');
            const path = await import('path');
            
            // Handle both relative and absolute paths
            const fullPath = filePath.startsWith('/') 
              ? filePath 
              : path.join(process.cwd(), filePath);
            
            if (fs.existsSync(fullPath)) {
              fs.unlinkSync(fullPath);
              filesDeleted++;
              console.log(`🗑️ Deleted file: ${filePath}`);
            } else {
              filesNotFound++;
              console.log(`⚠️ File not found: ${filePath}`);
            }
          } catch (fileError) {
            console.error(`❌ Error deleting file ${filePath}:`, fileError);
          }
        }

        const summary = {
          message: "All evidence successfully deleted from the system",
          evidenceRecordsDeleted: allEvidence.length,
          filesDeleted,
          filesNotFound,
          totalFilesProcessed: filePaths.length
        };

        console.log('✅ Evidence deletion completed:', summary);
        res.json(summary);

      } catch (error) {
        console.error("❌ Error deleting all evidence:", error);
        res.status(500).json({ message: "Failed to delete all evidence", error: error instanceof Error ? error.message : String(error) });
      }
      return;
    }

    // If not deleteAll, return the normal evidence list or error
    res.status(400).json({ message: "Invalid request. Use ?deleteAll=true to delete all evidence." });
  });

  app.get('/api/evidence/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const evidence = await storage.getEvidenceById(id);
      if (!evidence) {
        return res.status(404).json({ message: "Evidence not found" });
      }
      res.json(evidence);
    } catch (error) {
      console.error("Error fetching evidence:", error);
      res.status(500).json({ message: "Failed to fetch evidence" });
    }
  });

  app.put('/api/evidence/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const evidence = await storage.updateEvidence(id, updates);
      res.json(evidence);
    } catch (error) {
      console.error("Error updating evidence:", error);
      res.status(500).json({ message: "Failed to update evidence" });
    }
  });

  app.delete('/api/evidence/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteEvidence(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting evidence:", error);
      res.status(500).json({ message: "Failed to delete evidence" });
    }
  });

  // Evidence Versions routes
  app.get('/api/evidence/:id/versions', requireAuth, async (req, res) => {
    try {
      const evidenceId = parseInt(req.params.id);
      const versions = await storage.getEvidenceVersions(evidenceId);
      res.json(versions);
    } catch (error) {
      console.error("Error fetching evidence versions:", error);
      res.status(500).json({ message: "Failed to fetch evidence versions" });
    }
  });

  app.post('/api/evidence/:id/versions', requireAuth, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const evidenceId = parseInt(req.params.id);
      const versionData = {
        evidenceId,
        version: req.body.version,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        filePath: req.file.path,
        uploadedById: req.userId,
      };

      const version = await storage.createEvidenceVersion(versionData);
      res.status(201).json(version);
    } catch (error) {
      console.error("Error creating evidence version:", error);
      res.status(500).json({ message: "Failed to create evidence version" });
    }
  });

  // Evidence Comments routes
  app.get('/api/evidence/:id/comments', requireAuth, async (req, res) => {
    try {
      const evidenceId = parseInt(req.params.id);
      const comments = await storage.getEvidenceComments(evidenceId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching evidence comments:", error);
      res.status(500).json({ message: "Failed to fetch evidence comments" });
    }
  });

  // Evidence linked to specific control
  app.get('/api/evidence/control/:controlId', requireAuth, async (req, res) => {
    try {
      const controlId = parseInt(req.params.controlId);
      
      // Get evidence directly linked to the control via ecc_control_id
      const evidenceList = await storage.getEvidence();
      const directlyLinkedEvidence = evidenceList.filter(evidence => evidence.eccControlId === controlId);
      
      // Also check for evidence linked through many-to-many relationship
      const linkedEvidence = [...directlyLinkedEvidence];
      for (const evidence of evidenceList) {
        // Skip if already included from direct relationship
        if (evidence.eccControlId === controlId) continue;
        
        try {
          const evidenceControls = await storage.getEvidenceControls(evidence.id);
          if (evidenceControls.some(ec => ec.eccControl.id === controlId)) {
            linkedEvidence.push(evidence);
          }
        } catch (error) {
          // Continue if getEvidenceControls fails for this evidence
          console.log(`Could not get controls for evidence ${evidence.id}:`, (error as Error).message);
        }
      }
      
      console.log(`Found ${linkedEvidence.length} evidence items linked to control ${controlId}`);
      res.json(linkedEvidence);
    } catch (error) {
      console.error("Error fetching evidence for control:", error);
      res.status(500).json({ message: "Failed to fetch evidence for control" });
    }
  });

  // Evidence versions for a specific task
  app.get('/api/evidence/versions/:taskId', requireAuth, async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      // This would fetch versions for all evidence related to the task
      const versions = await storage.getEvidenceVersions(taskId);
      res.json(versions);
    } catch (error) {
      console.error("Error fetching evidence versions for task:", error);
      res.status(500).json({ message: "Failed to fetch evidence versions" });
    }
  });

  // Evidence comments for a specific task
  app.get('/api/evidence/comments/:taskId', requireAuth, async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      // This would fetch comments for all evidence related to the task
      const comments = await storage.getEvidenceComments(taskId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching evidence comments for task:", error);
      res.status(500).json({ message: "Failed to fetch evidence comments" });
    }
  });

  // Create evidence comment
  app.post('/api/evidence/:id/comments', requireAuth, async (req: AuthRequest, res) => {
    try {
      const evidenceId = parseInt(req.params.id);
      const { comment, isSystemComment, commentType } = req.body;
      
      if (!comment || comment.trim() === '') {
        return res.status(400).json({ message: "Comment content is required" });
      }
      
      const commentData = {
        evidenceId,
        userId: req.userId,
        comment: comment.trim(),
        isSystemComment: isSystemComment || false,
        commentType: commentType || 'user',
      };
      
      const newComment = await storage.createEvidenceComment(commentData);
      res.status(201).json(newComment);
    } catch (error) {
      console.error("Error creating evidence comment:", error);
      res.status(500).json({ message: "Failed to create evidence comment" });
    }
  });

  // Evidence Controls routes
  app.get('/api/evidence/:id/controls', requireAuth, async (req, res) => {
    try {
      const evidenceId = parseInt(req.params.id);
      const controls = await storage.getEvidenceControls(evidenceId);
      res.json(controls);
    } catch (error) {
      console.error("Error fetching evidence controls:", error);
      res.status(500).json({ message: "Failed to fetch evidence controls" });
    }
  });

  // Get evidence linked to a specific control
  app.get('/api/controls/:controlId/evidence', requireAuth, async (req, res) => {
    try {
      const controlId = parseInt(req.params.controlId);
      const evidenceList = await storage.getControlLinkedEvidence(controlId);
      res.json(evidenceList);
    } catch (error) {
      console.error("Error fetching control evidence:", error);
      res.status(500).json({ message: "Failed to fetch control evidence" });
    }
  });

  app.post('/api/evidence/:id/controls', requireAuth, async (req, res) => {
    try {
      const evidenceId = parseInt(req.params.id);
      const { controlIds } = req.body;
      
      if (!Array.isArray(controlIds)) {
        return res.status(400).json({ message: "controlIds must be an array" });
      }
      
      await storage.addControlsToEvidence(evidenceId, controlIds);
      res.status(201).json({ message: "Controls added to evidence successfully" });
    } catch (error) {
      console.error("Error adding controls to evidence:", error);
      res.status(500).json({ message: "Failed to add controls to evidence" });
    }
  });

  app.delete('/api/evidence/:id/controls', requireAuth, async (req, res) => {
    try {
      const evidenceId = parseInt(req.params.id);
      const { controlIds } = req.body;
      
      if (!Array.isArray(controlIds)) {
        return res.status(400).json({ message: "controlIds must be an array" });
      }
      
      await storage.removeControlsFromEvidence(evidenceId, controlIds);
      res.json({ message: "Controls removed from evidence successfully" });
    } catch (error) {
      console.error("Error removing controls from evidence:", error);
      res.status(500).json({ message: "Failed to remove controls from evidence" });
    }
  });

  // Evidence Tasks routes
  app.get('/api/evidence/:id/tasks', requireAuth, async (req, res) => {
    try {
      const evidenceId = parseInt(req.params.id);
      const tasks = await storage.getEvidenceTasks(evidenceId);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching evidence tasks:", error);
      res.status(500).json({ message: "Failed to fetch evidence tasks" });
    }
  });

  app.post('/api/evidence/:id/tasks', requireAuth, async (req, res) => {
    try {
      const evidenceId = parseInt(req.params.id);
      const { taskIds } = req.body;
      
      if (!Array.isArray(taskIds)) {
        return res.status(400).json({ message: "taskIds must be an array" });
      }
      
      await storage.addTasksToEvidence(evidenceId, taskIds);
      res.status(201).json({ message: "Tasks added to evidence successfully" });
    } catch (error) {
      console.error("Error adding tasks to evidence:", error);
      res.status(500).json({ message: "Failed to add tasks to evidence" });
    }
  });

  app.delete('/api/evidence/:id/tasks', requireAuth, async (req, res) => {
    try {
      const evidenceId = parseInt(req.params.id);
      const { taskIds } = req.body;
      
      if (!Array.isArray(taskIds)) {
        return res.status(400).json({ message: "taskIds must be an array" });
      }
      
      await storage.removeTasksFromEvidence(evidenceId, taskIds);
      res.json({ message: "Tasks removed from evidence successfully" });
    } catch (error) {
      console.error("Error removing tasks from evidence:", error);
      res.status(500).json({ message: "Failed to remove tasks from evidence" });
    }
  });

  // Direct Evidence-Control Relationship routes (modern system)
  app.post('/api/evidence/:id/link-control', requireAuth, requireEditEvidence, async (req, res) => {
    try {
      const evidenceId = parseInt(req.params.id);
      const { projectRegulationControlId } = req.body;
      
      if (!projectRegulationControlId) {
        return res.status(400).json({ message: "projectRegulationControlId is required" });
      }
      
      await storage.linkEvidenceToControl(evidenceId, projectRegulationControlId);
      res.status(201).json({ message: "Evidence linked to control successfully" });
    } catch (error) {
      console.error("Error linking evidence to control:", error);
      res.status(500).json({ message: "Failed to link evidence to control" });
    }
  });

  app.delete('/api/evidence/:id/link-control', requireAuth, requireEditEvidence, async (req, res) => {
    try {
      const evidenceId = parseInt(req.params.id);
      const { projectRegulationControlId } = req.body;
      
      if (!projectRegulationControlId) {
        return res.status(400).json({ message: "projectRegulationControlId is required" });
      }
      
      await storage.unlinkEvidenceFromControl(evidenceId, projectRegulationControlId);
      res.json({ message: "Evidence unlinked from control successfully" });
    } catch (error) {
      console.error("Error unlinking evidence from control:", error);
      res.status(500).json({ message: "Failed to unlink evidence from control" });
    }
  });

  app.get('/api/evidence/:id/control-links', requireAuth, requireViewEvidence, async (req, res) => {
    try {
      const evidenceId = parseInt(req.params.id);
      const links = await storage.getEvidenceControlLinks(evidenceId);
      res.json(links);
    } catch (error) {
      console.error("Error fetching evidence control links:", error);
      res.status(500).json({ message: "Failed to fetch evidence control links" });
    }
  });

  // Custom Regulations routes
  app.get('/api/custom-regulations', requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.userId);
      const regulations = await storage.getCustomRegulations(user?.organizationId || undefined);
      res.json(regulations);
    } catch (error) {
      console.error("Error fetching custom regulations:", error);
      res.status(500).json({ message: "Failed to fetch custom regulations" });
    }
  });

  app.get('/api/custom-regulations/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const regulation = await storage.getCustomRegulation(id);
      if (!regulation) {
        return res.status(404).json({ message: "Custom regulation not found" });
      }
      
      // Fetch associated controls for this regulation
      const controls = await storage.getCustomControls(id);
      
      // Return regulation with controls included
      res.json({
        ...regulation,
        controls
      });
    } catch (error) {
      console.error("Error fetching custom regulation:", error);
      res.status(500).json({ message: "Failed to fetch custom regulation" });
    }
  });

  app.post('/api/custom-regulations', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId;
      const user = await storage.getUser(userId);
      
      const { controls, ...regulationData } = req.body;
      
      const regulation = await storage.createCustomRegulation({
        ...regulationData,
        organizationId: user?.organizationId || 'default',
        createdById: userId,
      });

      // Create associated controls if provided
      if (controls && Array.isArray(controls) && controls.length > 0) {
        for (const controlData of controls) {
          // Ensure the control data doesn't contain invalid fields
          const {
            mainDomain,
            mainDomainAr,
            subDomain,
            subDomainAr,
            control,
            controlAr,
            subControl,
            subControlAr,
            description,
            descriptionAr,
            evidenceRequired,
            evidenceNote,
            evidenceNoteAr,
            tags,
          } = controlData;

          await storage.createCustomControl({
            mainDomain,
            mainDomainAr,
            subDomain,
            subDomainAr,
            control,
            controlAr,
            subControl,
            subControlAr,
            description,
            descriptionAr,
            evidenceRequired: Boolean(evidenceRequired),
            evidenceNote,
            evidenceNoteAr,
            tags: Array.isArray(tags) ? tags : [],
            customRegulationId: regulation.id,
            code: `CR-${regulation.id}-${String(controls.indexOf(controlData) + 1).padStart(3, '0')}`, // Generate unique code
          });
        }
      }
      
      res.status(201).json(regulation);
    } catch (error) {
      console.error("Error creating custom regulation:", error);
      res.status(500).json({ message: "Failed to create custom regulation" });
    }
  });

  app.put('/api/custom-regulations/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const regulation = await storage.updateCustomRegulation(id, req.body);
      res.json(regulation);
    } catch (error) {
      console.error("Error updating custom regulation:", error);
      res.status(500).json({ message: "Failed to update custom regulation" });
    }
  });

  app.delete('/api/custom-regulations/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCustomRegulation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting custom regulation:", error);
      res.status(500).json({ message: "Failed to delete custom regulation" });
    }
  });

  // XLSX Import endpoint with dry-run support
  app.post('/api/custom-regulations/import', requireAuth, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Missing file" });

      const userId = req.userId;
      const user = await storage.getUser(userId);
      const isDryRun = req.body.dryRun === 'true';

      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });

      if (!rows.length) return res.status(400).json({ message: "Empty sheet" });

      // header normalization helper
      const norm = (s:string) => s.toLowerCase().trim()
        .replace(/\u200f|\u200e/g, "") // strip RTL marks
        .replace(/\s+/g, " ");

      // try to map common ECC/DCC headers to our custom controls schema
      const mapRow = (r:any, index: number) => {
        const keys = Object.keys(r).reduce((acc:any, k:string) => (acc[norm(k)] = k, acc), {});
        const get = (names:string[]) => (r[keys[names.find(n => keys[n])!]] ?? "").toString().trim();

        return {
          rowIndex: index + 1,
          code: get(['clause number','clause','code','رقم البند']),
          mainDomain: get(['main category','domain','المكون الأساسي']),
          mainDomainAr: get(['المكون الأساسي ','domain ar']),
          subDomain: get(['sub category','subdomain','المكون الفرعي']),
          subDomainAr: get(['المكون الفرعي ','subdomain ar']),
          control: get(['main control','control','الضابط الأساسي']),
          controlAr: get(['الضابط الأساسي']),
          subControl: get(['sub control','الضابط الفرعي']),
          subControlAr: get(['الضابط الفرعي ']),
          description: get(['clear description of the requirement','requirement','وصف واضح للمتطلبات']) || get(['description']),
          descriptionAr: get(['وصف واضح للمتطلبات']),
          evidenceRequired: !!get(['evidence required']).toLowerCase().includes('yes'),
          evidenceNote: get(['evidence type','evidence','نوع الدليل المفترض تسليمه']),
          tags: (get(['related refs','tags']) || '').split(/[$,;|]/).map((t: string) => t.trim()).filter(Boolean),
        };
      };

      const parsedControls = rows.map(mapRow);
      const validControls = parsedControls.filter(c => c.mainDomain && c.subDomain && (c.control || c.subControl));

      // Validation and error checking
      const errors: string[] = [];
      const warnings: string[] = [];
      
      if (parsedControls.length !== validControls.length) {
        const invalidRows = parsedControls.filter(c => !(c.mainDomain && c.subDomain && (c.control || c.subControl)));
        invalidRows.forEach(row => {
          errors.push(`Row ${row.rowIndex}: Missing required fields (domain, subdomain, or control)`);
        });
      }

      if (!validControls.length) {
        errors.push("No valid controls found in sheet. Check headers match template.");
      }

      // Check for duplicate codes
      const codes = validControls.map(c => c.code).filter(Boolean);
      const duplicateCodes = codes.filter((code, index) => codes.indexOf(code) !== index);
      if (duplicateCodes.length > 0) {
        warnings.push(`Duplicate control codes found: ${duplicateCodes.join(', ')}`);
      }

      // Check for missing codes
      const missingCodes = validControls.filter(c => !c.code);
      if (missingCodes.length > 0) {
        warnings.push(`${missingCodes.length} controls missing codes (auto-generated codes will be used)`);
      }

      // If dry-run, return validation results
      if (isDryRun) {
        const allControls = validControls.map(c => ({
          code: c.code || 'Auto-generated',
          mainDomain: c.mainDomain,
          subDomain: c.subDomain,
          control: (c.control || c.subControl || '').substring(0, 100) + ((c.control || c.subControl || '').length > 100 ? '...' : ''),
          evidenceRequired: c.evidenceRequired ? 'Yes' : 'No'
        }));

        return res.json({
          inserted: validControls.length,
          updated: 0,
          total: parsedControls.length,
          errors,
          warnings,
          allRecords: allControls
        });
      }

      // Actual import (non-dry-run)
      if (errors.length > 0) {
        return res.status(400).json({ message: "Validation failed", errors });
      }

      // Create the regulation
      const { name, version } = req.body;
      const reg = await storage.createCustomRegulation({
        name: name || (req.file.originalname.split('.').slice(0,-1).join('.') || 'Imported Regulation'),
        description: req.body.description || '',
        category: 'custom',
        framework: req.body.framework || '',
        version: version || '1.0',
        status: 'active',
        organizationId: user?.organizationId || 'default',
        createdById: userId,
      });

      // Bulk insert controls
      let insertedCount = 0;
      for (let i = 0; i < validControls.length; i++) {
        const c = validControls[i];
        try {
          await storage.createCustomControl({
            ...c,
            code: c.code || `CR-${reg.id}-${String(i+1).padStart(3,'0')}`,
            customRegulationId: reg.id,
          });
          insertedCount++;
        } catch (error) {
          console.error(`Failed to insert control ${i+1}:`, error);
          errors.push(`Failed to insert control at row ${c.rowIndex}`);
        }
      }

      res.status(201).json({ 
        regulationId: reg.id, 
        inserted: insertedCount,
        updated: 0,
        total: parsedControls.length,
        errors,
        warnings
      });
    } catch (e:any) {
      console.error("Import failed:", e);
      res.status(500).json({ message: "Failed to import regulation", error: e.message });
    }
  });

  // Custom Controls routes
  app.get('/api/custom-controls', requireAuth, async (req, res) => {
    try {
      const regulationId = req.query.regulationId ? parseInt(req.query.regulationId as string) : undefined;
      const controls = await storage.getCustomControls(regulationId);
      res.json(controls);
    } catch (error) {
      console.error("Error fetching custom controls:", error);
      res.status(500).json({ message: "Failed to fetch custom controls" });
    }
  });

  app.post('/api/custom-controls', requireAuth, async (req, res) => {
    try {
      const control = await storage.createCustomControl(req.body);
      res.status(201).json(control);
    } catch (error) {
      console.error("Error creating custom control:", error);
      res.status(500).json({ message: "Failed to create custom control" });
    }
  });

  app.put('/api/custom-controls/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const control = await storage.updateCustomControl(id, req.body);
      res.json(control);
    } catch (error) {
      console.error("Error updating custom control:", error);
      res.status(500).json({ message: "Failed to update custom control" });
    }
  });

  app.delete('/api/custom-controls/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCustomControl(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting custom control:", error);
      res.status(500).json({ message: "Failed to delete custom control" });
    }
  });

  // Get domain breakdown for a specific project and regulation
  app.get('/api/projects/:projectId/regulations/:regulationId/domains', requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const regulationId = req.params.regulationId;
      
      // For now, we'll focus on ECC regulation
      if (regulationId !== 'ecc') {
        return res.status(400).json({ message: "Only ECC regulation is currently supported" });
      }

      // Get all ECC controls grouped by domain
      const controls = await storage.getEccControls();
      
      // Get approved controls for this project
      const projectControls = await storage.getProjectControls(projectId);
      const approvedControlIds = new Set(
        projectControls
          .filter(pc => pc.status === 'completed')
          .map(pc => pc.controlId)
      );

      // Group controls by domain and calculate approved/total counts
      const domainStats: Record<string, { approved: number; total: number }> = {};
      
      controls.forEach(control => {
        const domain = control.domainEn;
        if (!domainStats[domain]) {
          domainStats[domain] = { approved: 0, total: 0 };
        }
        
        domainStats[domain].total++;
        if (approvedControlIds.has(control.id)) {
          domainStats[domain].approved++;
        }
      });

      // Format the response according to the specification
      const domains = Object.entries(domainStats).map(([domain, stats]) => ({
        name_en: domain,
        name_ar: getArabicDomainName(domain), // Helper function for Arabic names
        approved: stats.approved,
        total: stats.total
      }));

      const response = {
        project_id: projectId.toString(),
        regulation_id: regulationId,
        regulation_code: "NCA-ECC-2:2024",
        logo_url: "/assets/logos/nca-ecc.svg",
        title_en: "Essential Cybersecurity Controls (ECC - 2 : 2024)",
        title_ar: "الضوابط الأساسية للأمن السيبراني (2024 : 2 - ECC)",
        domains
      };

      res.json(response);
    } catch (error) {
      console.error("Error fetching domain breakdown:", error);
      res.status(500).json({ message: "Failed to fetch domain breakdown" });
    }
  });

  // Helper function to get Arabic domain names
  function getArabicDomainName(domainEn: string): string {
    const domainMap: Record<string, string> = {
      "Cybersecurity Governance": "حوكمة الأمن السيبراني",
      "Cybersecurity Defense": "دفاع الأمن السيبراني", 
      "Cybersecurity Resilience": "مرونة الأمن السيبراني",
      "Cybersecurity Third Party": "الأطراف الثالثة للأمن السيبراني"
    };
    return domainMap[domainEn] || domainEn;
  }

  // Email testing endpoint for SendGrid integration
  app.post('/api/test-email', requireAuth, async (req: AuthRequest, res) => {
    try {
      console.log('SendGrid test email request received:', req.body);
      const { to, type = 'basic' } = req.body;
      
      if (!to) {
        return res.status(400).json({ message: "Recipient email is required" });
      }

      if (!process.env.SENDGRID_API_KEY) {
        return res.status(500).json({ message: "Email service not configured. SENDGRID_API_KEY is missing." });
      }

      let result;
      const baseUrl = emailService.getBaseUrl();

      switch (type) {
        case 'task-assignment':
          result = await emailService.sendTaskAssignmentEmail(
            to,
            'Test User',
            'Sample Compliance Task - SendGrid Test',
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
            'Test Project',
            'en',
            123
          );
          break;
        case 'invitation':
          result = await emailService.sendInvitationEmail(
            to,
            'Admin User',
            'Ambersand Test Organization',
            'Welcome to our compliance management platform! This is a test of the new SendGrid integration.',
            `${baseUrl}/join?token=test123&email=${encodeURIComponent(to)}`
          );
          break;
        case 'deadline-reminder':
          result = await emailService.sendDeadlineReminderEmail(
            to,
            'Test User',
            'Sample Task with Approaching Deadline',
            new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString(),
            'en',
            456
          );
          break;
        case 'status-update':
          result = await emailService.sendStatusUpdateEmail(
            to,
            'Test User',
            'Sample Compliance Task',
            'in-progress',
            'completed',
            'en',
            789
          );
          break;
        case 'password-reset':
          result = await emailService.sendPasswordResetEmail(
            to,
            'Test User',
            `${baseUrl}/reset-password?token=test123`,
            'en'
          );
          break;
        case 'basic':
        default:
          result = await emailService.sendEmail({
            to,
            subject: 'SendGrid Integration Test - Ambersand Platform',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #2699A6; padding: 20px; text-align: center;">
                  <h1 style="color: white; margin: 0;">Ambersand</h1>
                  <p style="color: #e0f7fa; margin: 10px 0 0 0;">Compliance Management Platform</p>
                </div>
                <div style="padding: 30px;">
                  <h2 style="color: #2699A6;">SendGrid Integration Test</h2>
                  <p>This test email confirms that:</p>
                  <ul>
                    <li>✅ SendGrid Web API is properly configured</li>
                    <li>✅ Email service successfully migrated from Resend</li>
                    <li>✅ Base URL correctly set to: ${baseUrl}</li>
                    <li>✅ Retry logic implemented for reliability</li>
                    <li>✅ HTML and plain text content supported</li>
                  </ul>
                  <p><strong>Environment:</strong> ${process.env.NODE_ENV}</p>
                  <p><strong>Test Type:</strong> ${type}</p>
                  <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
                </div>
                <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #dee2e6;">
                  <p style="margin: 0; font-size: 12px; color: #666;">
                    © ${new Date().getFullYear()} Ambersand. All rights reserved.
                  </p>
                </div>
              </div>
            `
          });
          break;
      }

      if (result.success) {
        console.log(`✅ SendGrid test email sent successfully: ${type} to ${to}`);
        res.json({ 
          message: "Test email sent successfully via SendGrid",
          messageId: result.messageId,
          emailType: type,
          recipient: to,
          baseUrl,
          timestamp: new Date().toISOString()
        });
      } else {
        console.error(`❌ SendGrid test email failed: ${type} to ${to}`, result.error);
        res.status(500).json({ 
          message: "Failed to send test email",
          error: result.error,
          emailType: type,
          recipient: to
        });
      }
    } catch (error) {
      console.error("SendGrid test email error:", error);
      const errorMessage = (error as Error)?.message || 'Unknown error';
      res.status(500).json({ 
        message: "Failed to send test email", 
        error: errorMessage,
        emailType: req.body.type || 'unknown'
      });
    }
  });

  // Evidence upload endpoint
  app.post('/api/evidence/upload', requireAuth, upload.array('files', 10), async (req: any, res) => {
    try {
      console.log('Evidence upload request received:', {
        body: req.body,
        filesCount: req.files?.length || 0,
        user: req.userId
      });
      
      const taskId = parseInt(req.body.taskId);
      const projectId = parseInt(req.body.projectId);
      const controlId = req.body.controlId ? parseInt(req.body.controlId) : null;
      const comment = req.body.comment ? req.body.comment.trim() : null;
      const isNewVersion = req.body.isNewVersion === 'true';
      const parentEvidenceId = req.body.parentEvidenceId ? parseInt(req.body.parentEvidenceId) : null;
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const evidenceRecords = [];
      for (const file of files) {
        // Check if this is a new version upload based on isNewVersion and parentEvidenceId
        if (isNewVersion && parentEvidenceId) {
          const parentEvidence = await storage.getEvidenceById(parentEvidenceId);
          if (!parentEvidence) {
            throw new Error(`Parent evidence with ID ${parentEvidenceId} not found`);
          }
          
          // Get all existing versions to determine the next version number
          const existingVersions = await storage.getEvidenceVersions(parentEvidenceId);
          const maxVersion = existingVersions.length > 0 
            ? Math.max(...existingVersions.map(v => parseFloat(v.version)))
            : parseFloat(parentEvidence.version);
          const nextVersion = `${Math.floor(maxVersion) + 1}.0`;
          
          // First, store the current version as a version record if it doesn't exist
          const currentVersionExists = existingVersions.some(v => v.version === parentEvidence.version);
          if (!currentVersionExists) {
            await storage.createEvidenceVersion({
              evidenceId: parentEvidenceId,
              version: parentEvidence.version,
              fileName: parentEvidence.fileName,
              fileSize: parentEvidence.fileSize,
              fileType: parentEvidence.fileType,
              filePath: parentEvidence.filePath,
              uploadedById: parentEvidence.uploadedById,
            });
          }
          
          // Create a new version record for the uploaded file
          const version = await storage.createEvidenceVersion({
            evidenceId: parentEvidenceId,
            version: nextVersion,
            fileName: file.originalname,
            fileSize: file.size,
            fileType: file.mimetype,
            filePath: file.path,
            uploadedById: req.userId,
          });
          
          // Update the main evidence record to show the latest version
          const updatedEvidence = await storage.updateEvidence(parentEvidenceId, {
            version: nextVersion,
            fileName: file.originalname,
            filePath: file.path,
            fileSize: file.size,
            fileType: file.mimetype,
          });
          
          // Add version note as system comment if provided
          if (comment) {
            const systemComment = `Uploaded version ${nextVersion}: ${comment}`;
            await storage.createEvidenceComment({
              evidenceId: parentEvidenceId,
              userId: req.userId,
              comment: systemComment,
              isSystemComment: true,
              commentType: 'version_upload'
            });
          }
          
          evidenceRecords.push(updatedEvidence);
        } else {
          // Create new evidence record
          const evidenceData = {
            taskId: taskId || undefined,
            projectId: projectId || undefined,
            eccControlId: controlId || undefined, // Keep for backward compatibility
            title: file.originalname,
            titleAr: file.originalname,
            fileName: file.originalname,
            filePath: file.path,
            fileSize: file.size,
            fileType: file.mimetype,
            description: `Evidence file: ${file.originalname}`,
            descriptionAr: `ملف أدلة: ${file.originalname}`,
            uploadedById: req.userId,
          };
          
          console.log('Creating evidence record:', evidenceData);
          const evidence = await storage.createEvidence(evidenceData);
          
          // MODERN SYSTEM: Link evidence to project regulation controls
          if (controlId && projectId) {
            // Priority 1: Direct control linking when controlId is provided (specific control selected)
            try {
              const projectRegulationControl = await db.select({ id: projectRegulationControls.id })
                .from(projectRegulationControls)
                .where(and(
                  eq(projectRegulationControls.projectId, projectId),
                  eq(projectRegulationControls.controlId, controlId)
                ))
                .limit(1);

              if (projectRegulationControl.length > 0) {
                await storage.linkEvidenceToControl(evidence.id, projectRegulationControl[0].id);
                console.log(`🔗 Direct linked evidence ${evidence.id} to project regulation control ${projectRegulationControl[0].id} (control ${controlId})`);
              } else {
                // Fallback to legacy system
                await storage.addControlsToEvidence(evidence.id, [controlId]);
                console.log(`🔗 Fallback: Direct linked evidence ${evidence.id} to legacy ECC control ${controlId}`);
              }
            } catch (linkError) {
              console.log('⚠️ Could not link evidence directly to regulation controls:', linkError);
              // Fallback to legacy system
              await storage.addControlsToEvidence(evidence.id, [controlId]);
            }
          } else if (taskId && projectId && !controlId) {
            // Priority 2: Link to all task controls only when NO specific control is selected
            try {
              // Get task regulation controls to find which controls this evidence should be linked to
              const taskControls = await db.select({ controlId: taskRegulationControls.controlId })
                .from(taskRegulationControls)
                .where(eq(taskRegulationControls.taskId, taskId));

              for (const trc of taskControls) {
                // Find the project regulation control ID
                const projectRegulationControl = await db.select({ id: projectRegulationControls.id })
                  .from(projectRegulationControls)
                  .where(and(
                    eq(projectRegulationControls.projectId, projectId),
                    eq(projectRegulationControls.controlId, trc.controlId)
                  ))
                  .limit(1);

                if (projectRegulationControl.length > 0) {
                  // Link evidence to the modern regulation controls system
                  await storage.linkEvidenceToControl(evidence.id, projectRegulationControl[0].id);
                  console.log(`🔗 Linked evidence ${evidence.id} to project regulation control ${projectRegulationControl[0].id} (task-wide for control ${trc.controlId})`);
                }
              }
            } catch (linkError) {
              console.log('⚠️ Could not link evidence to modern regulation controls:', linkError);
              // Fallback to legacy system if modern linking fails
              if (taskId) {
                await storage.addTasksToEvidence(evidence.id, [taskId]);
                console.log(`🔗 Fallback: Linked evidence ${evidence.id} to task ${taskId}`);
              }
            }
          } else if (controlId && !projectId) {
            // Legacy control linking when controlId is provided but no projectId
            await storage.addControlsToEvidence(evidence.id, [controlId]);
            console.log(`🔗 Legacy: Linked evidence ${evidence.id} to ECC control ${controlId}`);
          } else {
            // Fallback to legacy system when modern linking is not possible
            if (taskId) {
              await storage.addTasksToEvidence(evidence.id, [taskId]);
              console.log(`🔗 Legacy: Linked evidence ${evidence.id} to task ${taskId}`);
            }
          }
          
          // Add comment if provided
          if (comment) {
            await storage.createEvidenceComment({
              evidenceId: evidence.id,
              userId: req.userId,
              comment: comment,
            });
          }
          
          evidenceRecords.push(evidence);
        }
      }

      console.log('Evidence upload successful:', evidenceRecords.length, 'files');
      res.status(201).json({
        message: "Files uploaded successfully",
        evidence: evidenceRecords,
      });
    } catch (error) {
      console.error("Error uploading evidence:", error);
      res.status(500).json({ message: "Failed to upload evidence" });
    }
  });

  // HTML escape utility
  const escapeHtml = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  };

  // Technical Support route
  app.post('/api/support', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { title, description, path, email, phoneNumber } = req.body || {};
      const t = String(title || '').trim();
      const d = String(description || '').trim();
      const e = String(email || '').trim();
      const p = String(phoneNumber || '').trim();

      // Validation
      if (t.length < 3 || t.length > 120) {
        return res.status(400).json({ error: 'Title must be between 3-120 characters' });
      }
      if (d.length < 10 || d.length > 4000) {
        return res.status(400).json({ error: 'Description must be between 10-4000 characters' });
      }

      // Check environment configuration
      if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) {
        console.error('SendGrid not configured: Missing SENDGRID_API_KEY or SENDGRID_FROM_EMAIL');
        return res.status(500).json({ error: 'Email service not configured' });
      }

      // Get user info for context
      const user = await storage.getUser(req.userId);
      const userEmail = user?.email || 'Unknown user';
      const userName = user?.firstName && user?.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : userEmail;

      // Use existing email service
      const { emailService } = await import('./emailService');

      const recipients = ['abdullah@ambersand.ai', 'rakan@ambersand.ai'];
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #333;">Technical Support Request</h2>
          
          <div style="background-color: #f5f5f5; padding: 15px; margin: 10px 0; border-left: 4px solid #007bff;">
            <h3 style="margin: 0; color: #007bff;">Title:</h3>
            <p style="margin: 5px 0 0 0; font-weight: bold;">${escapeHtml(t)}</p>
          </div>
          
          <div style="background-color: #f9f9f9; padding: 15px; margin: 10px 0;">
            <h3 style="margin: 0; color: #333;">Description:</h3>
            <p style="margin: 10px 0 0 0; white-space: pre-line;">${escapeHtml(d)}</p>
          </div>
          
          <div style="padding: 15px; background-color: #f0f0f0; margin: 10px 0;">
            <h3 style="margin: 0; color: #666;">Request Details:</h3>
            <p style="margin: 5px 0;"><strong>User:</strong> ${escapeHtml(userName)}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${escapeHtml(userEmail)}</p>
            ${e ? `<p style="margin: 5px 0;"><strong>Contact Email:</strong> ${escapeHtml(e)}</p>` : ''}
            ${p ? `<p style="margin: 5px 0;"><strong>Phone Number:</strong> ${escapeHtml(p)}</p>` : ''}
            <p style="margin: 5px 0;"><strong>Page:</strong> ${escapeHtml(path || 'Not specified')}</p>
            <p style="margin: 5px 0;"><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          </div>
          
          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            This support request was sent from the Ambersand Compliance Management System.
          </p>
        </div>
      `;

      // Send to both recipients with BCC
      for (const recipient of recipients) {
        await emailService.sendEmail({
          to: recipient,
          subject: `[Ambersand Support] ${t}`,
          html: htmlContent,
          bcc: 'mohamed@vrteek.com'
        });
      }

      console.log(`Support request sent to ${recipients.join(', ')} from user ${userEmail}`);
      res.json({ status: 'ok' });
    } catch (error) {
      console.error('Support request error:', error);
      res.status(500).json({ error: 'Failed to send support request' });
    }
  });

  // Serve uploaded files - accepts both JWT auth OR download token
  app.get('/api/evidence/:id/download', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const downloadToken = req.query.token as string;
      
      // Check authentication: either JWT token OR valid download token
      let isAuthenticated = false;
      
      // Option 1: JWT Bearer token (from web app)
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key');
          isAuthenticated = true;
        } catch (err) {
          // JWT invalid, try download token
        }
      }
      
      // Option 2: Signed download token (from PDF reports)
      if (!isAuthenticated && downloadToken) {
        try {
          const decoded = jwt.verify(downloadToken, process.env.JWT_SECRET || 'fallback-secret-key') as any;
          if (decoded.evidenceId === id && decoded.type === 'download') {
            isAuthenticated = true;
          }
        } catch (err) {
          // Download token invalid
        }
      }
      
      if (!isAuthenticated) {
        return res.status(401).json({ success: false, message: "Authentication required" });
      }
      
      const evidence = await storage.getEvidence();
      const evidenceItem = evidence.find(e => e.id === id);
      
      if (!evidenceItem) {
        return res.status(404).json({ message: "Evidence not found" });
      }

      // Ensure the file path is relative to the project root
      const fs = await import('fs');
      const path = await import('path');
      
      // Handle both relative and absolute paths
      const filePath = evidenceItem.filePath.startsWith('/') 
        ? evidenceItem.filePath 
        : path.join(process.cwd(), evidenceItem.filePath);
      
      // Check if file exists before attempting download
      if (!fs.existsSync(filePath)) {
        console.error(`Evidence file not found: ${evidenceItem.fileName} at ${filePath}`);
        return res.status(404).json({ 
          message: "Evidence file not found on server",
          details: `File "${evidenceItem.fileName}" is missing from storage`
        });
      }

      res.download(filePath, evidenceItem.fileName);
    } catch (error) {
      console.error("Error downloading evidence:", error);
      res.status(500).json({ message: "Failed to download evidence" });
    }
  });

  // Reports router
  // Auth routes (email/password authentication with JWT)
  app.use("/api/auth", authRouter);

  // Comments routes
  const commentsRouter = (await import("./routes/comments")).default;
  app.use("/api/comments", commentsRouter);

  // Users routes (search, invite)
  const usersRouter = (await import("./routes/users")).default;
  app.use("/api/users", usersRouter);

  // Risk management routes
  app.use("/api/risks", requireAuth, risksRouter);

  // Analytics routes
  app.use("/api/analytics", requireAuth, analyticsRouter);

  // Workflow routes
  app.use("/api/workflows", requireAuth, workflowsRouter);

  // Regulations routes
  app.use("/api/regulations", regulationsRouter);

  // Projects routes
  app.use("/api/projects", projectsRouter);

  // Notifications routes
  app.use("/api/notifications", requireAuth, notificationsRouter);

  // Test PDF generation endpoint (public for testing)
  app.get("/api/test-pdf-public", async (req: any, res) => {
    try {
      const { buildPDF } = await import('./reports/reportBuilders');

      const testHtml = `
        <html>
        <head>
          <title>PDF Test</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; }
            h1 { color: #2699A6; }
            .test-content { background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px; }
          </style>
        </head>
        <body>
          <h1>wkhtmltopdf Test Document</h1>
          <p>This is a test document to verify that wkhtmltopdf is working correctly.</p>
          <div class="test-content">
            <h3>System Information</h3>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
            <p><strong>User ID:</strong> ${req.userId || 'N/A'}</p>
          </div>
          <p>If you can see this PDF, wkhtmltopdf is functioning properly!</p>
        </body>
        </html>
      `;

      const pdfBuffer = await buildPDF(testHtml);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="wkhtmltopdf-test.pdf"');
      res.send(pdfBuffer);

    } catch (error) {
      console.error('PDF test failed:', error);
      res.status(500).json({
        error: 'PDF generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: 'Check server logs for more information'
      });
    }
  });

  // Export route
  app.post("/api/reports/compliance/export", requireAuth, async (req: AuthRequest, res) => {
    console.log('📋 Compliance report export request received:', {
      user: req.userId,
      body: JSON.stringify(req.body, null, 2)
    });

    const schema = z.object({
      projectId: z.number(),
      regulationCode: z.string().optional(),
      formats: z.object({
        pdf: z.boolean().optional(),
        docx: z.boolean().optional(),
        xlsx: z.boolean().optional(),
      }),
      evidenceMode: z.enum(["attach","link","both"]).default("both"),
      controlStatus: z.union([z.literal("all"), z.literal("approved"), z.literal("unapproved")]).default("all"),
      language: z.enum(["en","ar"]).default("en"),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid payload", issues: parsed.error.issues });

    const { projectId, regulationCode, formats, evidenceMode, controlStatus, language } = parsed.data;

    try {
      // Optional tenant check: ensure the project belongs to req.organizationId
      const report = await getComplianceReportData({
        projectId,
        regulationCode,
        controlStatusFilter: controlStatus,
        organizationId: req.organizationId || 'default',
      });

      const selected = { pdf: !!formats?.pdf, docx: !!formats?.docx, xlsx: !!formats?.xlsx };
      const count = Object.values(selected).filter(Boolean).length;

      // Determine if ZIP is needed based on evidence mode and format count
      // ZIP is needed when:
      // 1. Evidence mode is "attach" or "both" (need to include evidence files)
      // 2. Multiple formats are requested
      const needsZip = evidenceMode === "attach" || evidenceMode === "both" || count > 1;
      // Enable clickable links when evidence files are linked, attached, or both
      const evidenceLinksAvailable = (evidenceMode === "link" || evidenceMode === "attach" || evidenceMode === "both");

      // Generate base URL for clickable links in PDF
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const baseUrl = `${protocol}://${host}`;

      const html = renderComplianceHTML(report, language, evidenceLinksAvailable, baseUrl);

      if (needsZip) {
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename="Ambersand_Compliance_Report_${report.project.name}.zip"`);
        await streamBundle({
          report,
          formats: selected,
          includeEvidence: evidenceMode, // 'attach' | 'link' | 'both'
          res,
          htmlContent: html,
        });
        return;
      }

      // Single file + link-only → return file directly
      if (selected.pdf) {
        const buf = await buildPDF(html);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="Compliance_Report_${report.project.name}.pdf"`);
        return res.send(buf);
      }
      if (selected.docx) {
        const buf = await buildDOCX(report);
        res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        res.setHeader("Content-Disposition", `attachment; filename="Compliance_Report_${report.project.name}.docx"`);
        return res.send(buf);
      }
      if (selected.xlsx) {
        const buf = await buildXLSX(report);
        res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="Compliance_Report_${report.project.name}.xlsx"`);
        return res.send(buf);
      }

      return res.status(400).json({ message: "Select at least one format." });
    } catch (err) {
      console.error("Export error:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      return res.status(500).json({
        message: "Failed to export compliance report",
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? (err instanceof Error ? err.stack : err) : undefined
      });
    }
  });

  // Email template test route
  app.post('/api/email/test-template', requireAuth, async (req: AuthRequest, res) => {
    const to = String(req.body?.to || "").trim();
    if (!to) return res.status(400).json({ message: "Missing 'to'" });

    try {
      const email = (await import('./email')).default;
      const result = await email.send({
        to,
        subject: "Template Test",
        // try both knobs:
        templateId: process.env.SENDGRID_TASK_TEMPLATE_ID, // ignored if smtp
        templateName: "task-assigned",                     // used if smtp
        data: {
          assigneeName: req.user?.firstName || req.user?.name || "Member",
          taskTitle: "Demo task",
          projectName: "Demo project",
          dueDate: "Not set",
          priority: "medium",
          description: "This is a test task created for email template testing.",
          taskUrl: `${process.env.APP_BASE_URL || "http://localhost:5000"}/tasks/123`,
        },
      });

      if (!result.success) return res.status(502).json(result);
      res.json({ ok: true, driver: process.env.EMAIL_DRIVER || "sendgrid", ...result });
    } catch (error) {
      console.error('Email template test error:', error);
      res.status(500).json({ message: "Test failed", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Helper function to normalize headers for ECC/DCC bilingual support
  function normalizeHeaders(headers: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};
    const canonicalKeys = [
      { canonical: 'clause', variants: ['clause', 'clause number', 'رقم البند', 'البند', 'code'] },
      { canonical: 'mainCategoryEn', variants: ['main category', 'main domain', 'المجال الرئيسي', 'الفئة الرئيسية'] },
      { canonical: 'subCategoryEn', variants: ['sub category', 'sub domain', 'المجال الفرعي', 'الفئة الفرعية'] },
      { canonical: 'controlEn', variants: ['control', 'requirement', 'الضابط', 'المتطلب'] },
      { canonical: 'descriptionEn', variants: ['description', 'details', 'الوصف', 'التفاصيل'] }
    ];
    
    headers.forEach((header, index) => {
      const normalized = header.toLowerCase().trim();
      for (const key of canonicalKeys) {
        if (key.variants.some(variant => normalized.includes(variant.toLowerCase()))) {
          mapping[key.canonical] = header;
          break;
        }
      }
    });
    
    return mapping;
  }

  // Admin regulation import endpoints
  app.post('/api/admin/regulations/import',
    (req, res, next) => {
      console.log('🔵 Step 1: Request received at /api/admin/regulations/import');
      next();
    },
    requireAuth,
    (req, res, next) => {
      console.log('🔵 Step 2: Authentication passed');
      next();
    },
    requirePermissions(['regulation:import']),
    (req, res, next) => {
      console.log('🔵 Step 3: Permission check passed');
      next();
    },
    upload.single('file'),
    (req: any, res, next) => {
      console.log('🔵 Step 4: File upload middleware passed, file:', !!req.file);
      if (req.file) {
        console.log('   File details:', {
          name: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype
        });
      }
      next();
    },
    async (req: any, res) => {
    let phase = 'initial';
    let rows: any[] = [];

    const logFile = path.join(process.cwd(), 'import-debug.log');
    const log = (msg: string) => {
      const timestamp = new Date().toISOString();
      const logMsg = `${timestamp} - ${msg}\n`;
      console.log(msg);
      fs.appendFileSync(logFile, logMsg);
    };

    log('\n🚀 ========== IMPORT REQUEST RECEIVED ==========');
    log(`User: ${req.user?.email || req.user?.id}`);
    log(`File received: ${!!req.file}`);
    log(`Body: ${JSON.stringify(req.body)}`);

    try {
      const { code, nameEn, nameAr, version, publisher } = req.body;
      const dryRun = req.query.dryRun === '1' || req.query.dryRun === 'true';

      log(`Dry run mode: ${dryRun}`);

      if (!req.file) {
        log('❌ No file uploaded');
        return res.status(400).json({ message: "No file uploaded (field name must be 'file')." });
      }

      log(`📎 File info: ${JSON.stringify({
        name: req.file.originalname,
        size: req.file.buffer.length,
        mimetype: req.file.mimetype
      })}`);

      if (!code || !nameEn || !version) {
        console.error('❌ Missing required fields:', { code: !!code, nameEn: !!nameEn, version: !!version });
        return res.status(400).json({ message: "Code, Name (English), and Version are required" });
      }

      // Detect format and parse
      const filename = req.file.originalname || 'upload';
      const ext = path.extname(filename).toLowerCase();
      
      try {
        if (ext === '.xlsx') {
          phase = 'parse-xlsx';
          console.log('📄 Parsing XLSX file, buffer size:', req.file.buffer.length);

          const wb = XLSX.read(req.file.buffer, {
            type: 'buffer',
            cellDates: true,
            raw: false
          });

          console.log('📊 Workbook loaded, sheets:', wb.SheetNames);

          if (!wb.SheetNames || wb.SheetNames.length === 0) {
            throw new Error('No sheets found in Excel file');
          }

          const sheetName = wb.SheetNames[0];
          const sheetData = wb.Sheets[sheetName];

          console.log('📋 Reading sheet:', sheetName, 'Sheet ref:', sheetData?.['!ref']);

          if (!sheetData) {
            throw new Error(`Sheet "${sheetName}" is empty or could not be read`);
          }

          // Check if sheet has any data
          if (!sheetData['!ref']) {
            throw new Error(`Sheet "${sheetName}" has no cell references - completely empty`);
          }

          const range = XLSX.utils.decode_range(sheetData['!ref']);
          console.log('📏 Sheet range:', range, `Rows: ${range.e.r + 1}, Cols: ${range.e.c + 1}`);

          if (range.e.r < 1) { // Less than 2 rows (header + data)
            throw new Error(`Sheet "${sheetName}" has no data rows (only ${range.e.r + 1} row(s) found). Need at least header row + 1 data row.`);
          }

          rows = XLSX.utils.sheet_to_json(sheetData, { defval: '', blankrows: false });
          console.log('✅ Parsed rows:', rows.length);
          
        } else if (ext === '.csv') {
          phase = 'parse-csv';
          log(`📄 Parsing CSV file, buffer size: ${req.file.buffer.length}`);

          rows = parseCsv(req.file.buffer, {
            columns: true,
            skip_empty_lines: true,
            bom: true,
            trim: true
          });

          log(`✅ CSV parsed, rows type: ${typeof rows}, Is array: ${Array.isArray(rows)}, Length: ${rows?.length}`);
          if (rows && rows.length > 0) {
            log(`📋 First row keys: ${Object.keys(rows[0]).join(', ')}`);
            log(`📋 First row sample: ${JSON.stringify(rows[0]).substring(0, 200)}`);
          }

        } else {
          return res.status(400).json({ message: `Unsupported file type: ${ext}. Use .xlsx or .csv.` });
        }
        
        if (!Array.isArray(rows) || rows.length === 0) {
          return res.status(400).json({
            message: 'Parsed zero rows. Check the first sheet or CSV headers.',
            phase,
            hint: ext === '.xlsx' ? 'Is the first sheet empty?' : 'Does the CSV have proper headers?',
            debug: {
              rowsType: typeof rows,
              isArray: Array.isArray(rows),
              rowsLength: rows?.length,
              fileSize: req.file.buffer.length,
              fileName: req.file.originalname,
              ext: ext
            }
          });
        }
        
      } catch (parseError: any) {
        console.error('Parse error:', parseError);
        return res.status(400).json({
          message: 'Failed to parse file',
          detail: parseError?.message || 'Unknown parsing error',
          phase,
          hint: phase === 'parse-xlsx' ? 'Is the first sheet empty? Make sure it has data rows with headers.' : 'Check CSV encoding and format',
          sample: Array.isArray(rows) && rows.length > 0 && rows[0] ? Object.keys(rows[0]).slice(0, 8) : undefined
        });
      }
      
      // Normalize headers and validate
      const firstRow = rows[0] || {};
      const headers = Object.keys(firstRow);
      const headerMapping = normalizeHeaders(headers);
      
      let inserted = 0, updated = 0, errors: string[] = [], warnings: string[] = [];
      
      // Validate essential headers
      if (!headerMapping.clause) {
        errors.push("Missing essential header: 'Clause Number' or 'رقم البند' not found");
      }
      
      // Process rows and collect any missing clause errors
      const validRows = rows.filter(row => {
        const clauseValue = headerMapping.clause ? row[headerMapping.clause] : null;
        if (!clauseValue || clauseValue.toString().trim() === '') {
          errors.push(`Row missing clause number: ${JSON.stringify(row).substring(0, 100)}...`);
          return false;
        }
        return true;
      });
      
      if (!dryRun && errors.length === 0) {
        // Create or update the regulation
        const userId = req.userId;
        const orgId = req.organizationId || 'default';
        
        const regulationData = {
          name: nameEn,
          nameAr: nameAr || null,
          description: `Imported from ${filename}`,
          descriptionAr: null,
          category: 'external' as const,
          framework: code,
          version: version,
          status: 'active' as const,
          organizationId: orgId,
          createdById: userId,
          approvedById: userId,
          approvedAt: new Date(),
        };
        
        // Check if regulation already exists
        const existingRegulation = await storage.getCustomRegulations(orgId);
        const existing = existingRegulation?.find(r => r.framework === code);
        
        if (existing) {
          await storage.updateCustomRegulation(existing.id, regulationData);
          updated = 1;
        } else {
          await storage.createCustomRegulation(regulationData);
          inserted = 1;
        }
      } else {
        // Dry run or has errors - just validate and count
        inserted = validRows.length;
        
        if (validRows.length !== rows.length) {
          warnings.push(`${rows.length - validRows.length} rows will be skipped due to missing clause numbers`);
        }
      }
      
      res.json({
        inserted,
        updated,
        total: rows.length,
        warnings,
        errors,
        sample: validRows.slice(0, 5)
      });
      
    } catch (error: any) {
      console.error('Regulation import error:', error);
      return res.status(500).json({
        message: 'Import failed',
        detail: error?.message || 'Unknown server error',
        phase,
        sample: rows?.[0] ? Object.keys(rows[0]).slice(0, 8) : undefined
      });
    }
  });

  // Test CSV parsing endpoint
  app.post('/api/test-csv-parse', upload.single('file'), (req: any, res) => {
    try {
      if (!req.file) {
        return res.json({ error: 'No file', hasFile: false });
      }

      const buffer = req.file.buffer;
      const ext = path.extname(req.file.originalname).toLowerCase();

      const result: any = {
        fileName: req.file.originalname,
        fileSize: buffer.length,
        ext: ext,
        mimetype: req.file.mimetype
      };

      if (ext === '.csv') {
        const rows = parseCsv(buffer, {
          columns: true,
          skip_empty_lines: true,
          bom: true,
          trim: true
        });

        result.rowCount = rows?.length || 0;
        result.rowsType = typeof rows;
        result.isArray = Array.isArray(rows);
        if (rows && rows.length > 0) {
          result.firstRowKeys = Object.keys(rows[0]);
          result.firstRow = rows[0];
        }
      }

      res.json(result);
    } catch (error: any) {
      res.json({ error: error.message, stack: error.stack });
    }
  });

  // Serve test sample CSV
  app.get('/test-regulation-sample.csv', (req, res) => {
    try {
      const filePath = path.join(process.cwd(), 'test-regulation-sample.csv');
      if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
      } else {
        res.status(404).json({ message: 'Test sample file not found' });
      }
    } catch (error) {
      console.error('Error serving test sample:', error);
      res.status(500).json({ message: 'Failed to serve test sample' });
    }
  });

  // Download CSV template
  app.get('/api/admin/regulations/template.csv', requireAuth, requirePermissions(['regulation:import']), (req, res) => {
    try {
      const headers = [
        "#",
        "Clause Number",
        "رقم البند ",
        "Main Category",
        "المكون الأساسي ",
        "Sub Category",
        "المكون الفرعي ",
        "Main Control",
        "الضابط الأساسي",
        "Sub Control",
        "الضابط الفرعي ",
        "Clear description of the requirement",
        "وصف واضح للمتطلبات",
        "Evidence Type",
        "نوع الدليل المفترض تسليمه",
        "Control or Subcontrol weight in scoring",
        "وزن الضابط أو الضابط الفرعي في التقييم",
        "ترقيم الضوابط التي تتطلب نفس الدليل"
      ];

      const rows = [
        [
          1, "1-1-1", "1-1-1",
          "Cybersecurity Governance", "حوكمة الأمن السيبراني",
          "Policies", "السياسات",
          "Establish governance", "إنشاء الحوكمة",
          "Policy approval workflow", "سير عمل اعتماد السياسات",
          "Document policy lifecycle; approvals; reviews", "توثيق دورة حياة السياسة والموافقات والمراجعات",
          "Policy Document$Approval Minutes$Review Log", "وثيقة السياسة$محاضر الموافقة$سجل المراجعة",
          "1.0", "1.0",
          "1-1-2$1-1-3"
        ],
        [
          2, "1-1-2", "1-1-2",
          "Cybersecurity Governance", "حوكمة الأمن السيبراني",
          "Policies", "السياسات",
          "Define roles", "تحديد الأدوار",
          "RACI for security", "مصفوفة RACI للأمن",
          "RACI matrix; role descriptions", "مصفوفة RACI ووصف الأدوار",
          "RACI$Org Chart", "RACI$الهيكل التنظيمي",
          "0.5", "0.5",
          "1-1-1"
        ]
      ];

      const escape = (s: any) => {
        const str = String(s ?? "");
        return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
      };

      const csv = [headers, ...rows].map(r => r.map(escape).join(",")).join("\r\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="regulation-template.csv"');
      res.send("\uFEFF" + csv); // prepend BOM for Excel Arabic
      
    } catch (error) {
      console.error("Template download error:", error);
      res.status(500).json({ message: "Failed to generate template" });
    }
  });

  // Get regulation versions
  app.get('/api/admin/regulations/:code/versions', requireAuth, requirePermissions(['regulation:import']), async (req: any, res) => {
    try {
      const { code } = req.params;
      const orgId = req.user?.organizationId || 'default';
      
      const regulations = await storage.getCustomRegulations(orgId);
      const versions = regulations?.filter(r => r.framework === code) || [];
      
      const result = versions.map(v => ({
        version: v.version,
        status: v.status,
        createdAt: v.createdAt,
        id: v.id
      }));
      
      res.json(result);
      
    } catch (error) {
      console.error("Get versions error:", error);
      res.status(500).json({ message: "Failed to fetch versions" });
    }
  });

  // Serve uploaded files (profile pictures and evidence) - require authentication
  // TODO: implement signed download route for proper security
  app.use('/uploads', requireAuth, (req, res, next) => {
    // Add CORS headers for uploaded files
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });
  // Secure uploaded files - require authentication
  const uploadsDir = path.join(process.cwd(), 'uploads');
  app.use('/uploads', requireAuth, express.static(uploadsDir)); // TODO: Implement signed download route for better security

  // Debug endpoint to test PDF generation and compare HTML vs PDF content
  app.get("/api/debug/pdf-content/:projectId", async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      console.log(`🔍 Debug: Testing PDF content for project ${projectId}`);

      const { getComplianceReportData } = await import('./reports/reportData');
      const { renderComplianceHTML } = await import('./reports/html');
      const { buildPDF } = await import('./reports/reportBuilders');

      // Create mock data if no real data exists
      let report;
      try {
        report = await getComplianceReportData({
          projectId,
          regulationCode: 'NCA-ECC-2:2024',
          controlStatusFilter: 'all'
        });
      } catch (error) {
        console.log('📝 Creating mock data for testing');
        report = {
          project: { id: projectId, name: 'Test Project', nameAr: null, organizationId: 'test' },
          regulation: { code: 'NCA-ECC-2:2024', name: 'Essential Cybersecurity Controls', version: '2024' },
          generatedAt: new Date().toISOString(),
          totals: { controls: 3, approved: 1, pending: 1, inProgress: 1, review: 0, blocked: 0 },
          controls: [
            {
              id: 1, code: 'ECC-1.1', title: 'Information Security Policy',
              titleAr: 'سياسة أمن المعلومات', domain: 'Governance',
              status: 'completed' as const, evidence: [
                { id: 1, title: 'Security Policy Document', fileName: 'security-policy.pdf', filePath: '/test/path', description: 'Main security policy document' }
              ]
            },
            {
              id: 2, code: 'ECC-2.1', title: 'Access Control Management',
              titleAr: 'إدارة التحكم في الوصول', domain: 'Access Control',
              status: 'in-progress' as const, evidence: []
            },
            {
              id: 3, code: 'ECC-3.1', title: 'Network Security',
              titleAr: 'أمن الشبكة', domain: 'Network Security',
              status: 'pending' as const, evidence: [
                { id: 2, title: 'Network Diagram', fileName: 'network-diagram.png', filePath: '/test/path2', description: 'Current network topology' }
              ]
            }
          ]
        };
      }

      const html = renderComplianceHTML(report, 'en', true, 'http://localhost:5001');

      // Save HTML for inspection
      const fs = await import('fs');
      fs.writeFileSync('/tmp/debug-report.html', html);

      // Generate PDF
      const pdfBuffer = await buildPDF(html);
      fs.writeFileSync('/tmp/debug-report.pdf', pdfBuffer);

      res.json({
        success: true,
        report: {
          projectName: report.project.name,
          controlsCount: report.controls.length,
          totals: report.totals,
        },
        html: {
          length: html.length,
          saved: '/tmp/debug-report.html',
          preview: html.substring(0, 2000)
        },
        pdf: {
          size: pdfBuffer.length,
          saved: '/tmp/debug-report.pdf'
        },
        message: 'Check /tmp/debug-report.html and /tmp/debug-report.pdf to compare content'
      });
    } catch (error) {
      console.error('Debug PDF content error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });

  // Debug endpoint for testing compliance report data generation (no auth required)
  app.get("/api/debug/compliance-report-data/:projectId", async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      console.log(`🔍 Debug: Getting compliance report data for project ${projectId}`);

      const { getComplianceReportData } = await import('./reports/reportData');
      const { renderComplianceHTML } = await import('./reports/html');

      const report = await getComplianceReportData({
        projectId,
        regulationCode: 'NCA-ECC-2:2024',
        controlStatusFilter: 'all'
      });

      const html = renderComplianceHTML(report, 'en', false, '');

      res.json({
        report: {
          projectName: report.project.name,
          controlsCount: report.controls.length,
          totals: report.totals,
          domains: Array.from(new Set(report.controls.map(c => c.domain))),
          sampleControls: report.controls.slice(0, 3).map(c => ({
            code: c.code,
            title: c.title,
            domain: c.domain,
            evidenceCount: c.evidence.length
          }))
        },
        htmlLength: html.length,
        htmlPreview: html.substring(0, 1000)
      });
    } catch (error) {
      console.error('Debug endpoint error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
