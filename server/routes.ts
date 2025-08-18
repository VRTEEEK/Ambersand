import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  insertProjectSchema,
  insertTaskSchema,
  insertEvidenceSchema,
  insertComplianceAssessmentSchema,
  insertControlAssessmentSchema,
} from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import { emailService } from "./emailService";
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

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // RBAC routes
  app.get('/api/me/permissions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const projectId = req.query.project_id ? parseInt(req.query.project_id) : undefined;
      
      const permissions = await getUserPermissions(userId, projectId);
      
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
  app.get('/api/users', isAuthenticated, requirePermissions(['change_user_permissions']), async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      const users = await storage.getAllUsers(currentUser?.organizationId || undefined);
      
      // Include user roles in response
      const usersWithRoles = await Promise.all(users.map(async (user) => ({
        ...user,
        userRoles: await storage.getUserRoles(user.id)
      })));
      
      res.json(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post('/api/users', isAuthenticated, requirePermissions(['change_user_permissions']), async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
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
  app.get('/api/roles', isAuthenticated, requirePermissions(['change_user_permissions']), async (req: any, res) => {
    try {
      const roles = await storage.getRoles();
      res.json(roles);
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });

  app.get('/api/permissions', isAuthenticated, requirePermissions(['change_user_permissions']), async (req: any, res) => {
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

  app.put('/api/users/:userId/roles', isAuthenticated, requirePermissions(['change_user_permissions']), async (req: any, res) => {
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

  app.get('/api/users/:userId/effective-permissions', isAuthenticated, requirePermissions(['change_user_permissions']), async (req: any, res) => {
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

  app.get('/api/users/:userId/roles', isAuthenticated, requirePermissions(['change_user_permissions']), async (req: any, res) => {
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
  app.post('/api/users/:userId/org-roles', isAuthenticated, requirePermissions(['change_user_permissions']), async (req: any, res) => {
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

  app.post('/api/users/:userId/project-roles', isAuthenticated, requirePermissions(['change_user_permissions']), async (req: any, res) => {
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

  app.get('/api/users/:userId/project-roles', isAuthenticated, requirePermissions(['change_user_permissions']), async (req: any, res) => {
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

  app.get('/api/users/:userId/effective-permissions', isAuthenticated, requirePermissions(['change_user_permissions']), async (req: any, res) => {
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
  app.post('/api/admin/users/bulk-assign', isAuthenticated, requirePermissions(['change_user_permissions']), async (req: any, res) => {
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
  app.post('/api/admin/users/bulk-assign-permissions', isAuthenticated, requirePermissions(['change_user_permissions']), async (req: any, res) => {
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
  app.get('/api/admin/users', isAuthenticated, requirePermissions(['change_user_permissions']), async (req: any, res) => {
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

  app.patch('/api/users/:userId', isAuthenticated, requirePermissions(['change_user_permissions']), async (req: any, res) => {
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
  app.post('/api/users/:userId/profile-picture', isAuthenticated, upload.single('profilePicture'), async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      
      // Only admins can update user profile pictures
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin role required." });
      }

      const { userId } = req.params;
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Generate a unique filename
      const fileExtension = path.extname(req.file.originalname);
      const fileName = `profile_${userId}_${Date.now()}${fileExtension}`;
      const filePath = path.join(uploadDir, fileName);
      
      // Move the file to the final location
      fs.renameSync(req.file.path, filePath);
      
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

  app.delete('/api/users/:userId', isAuthenticated, requirePermissions(['change_user_permissions']), async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
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

  // User invitation endpoints
  app.get('/api/admin/users/check-duplicate', isAuthenticated, requirePermissions(['change_user_permissions']), async (req: any, res) => {
    try {
      const { email } = req.query;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      
      if (existingUser) {
        return res.json({ 
          exists: true, 
          isPending: false,
          message: `User with email ${email} already exists in the system.`
        });
      }

      // For now, we'll assume no pending invitations exist
      // In a real system, you'd check a pending_invitations table
      res.json({ 
        exists: false, 
        isPending: false 
      });
    } catch (error) {
      console.error("Error checking duplicate user:", error);
      res.status(500).json({ message: "Failed to check for duplicate user" });
    }
  });

  app.post('/api/admin/users/invite', isAuthenticated, requirePermissions(['change_user_permissions']), async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      const { 
        email, 
        fullName, 
        personalMessage, 
        orgRoles = [], 
        projectAssignments = [] 
      } = req.body;

      if (!email || !email.includes('@')) {
        return res.status(400).json({ message: "Valid email is required" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ 
          message: `User with email ${email} already exists in the system.`
        });
      }

      // Create a new user ID (in real system, this would be generated by invitation system)
      const invitedUserId = `invited_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

      // Create the invited user
      const newUser = await storage.createUser({
        id: invitedUserId,
        email,
        firstName: fullName || '',
        lastName: '',
        role: 'viewer', // Default role in legacy field
        organizationId: currentUser?.organizationId || '',
      });

      // Assign organization roles
      if (orgRoles.length > 0) {
        for (const roleCode of orgRoles) {
          const role = await db.select().from(roles).where(eq(roles.code, roleCode)).limit(1);
          if (role.length > 0) {
            await storage.assignUserRole(invitedUserId, role[0].id);
          }
        }
      }

      // Assign project roles
      if (projectAssignments.length > 0) {
        for (const assignment of projectAssignments) {
          const { projectId, roles: projectRoles } = assignment;
          
          for (const roleCode of projectRoles) {
            const role = await db.select().from(roles).where(eq(roles.code, roleCode)).limit(1);
            if (role.length > 0) {
              await storage.assignUserProjectRole(invitedUserId, projectId, role[0].id);
            }
          }
        }
      }

      // Send invitation email if email service is configured
      try {
        // Use the emailService's base URL method
        const baseUrl = emailService.getBaseUrl();
        
        const result = await emailService.sendInvitationEmail(
          email,
          currentUser?.firstName || currentUser?.email?.split('@')[0] || 'System Admin',
          'Ambersand Compliance',
          personalMessage || '',
          `${baseUrl}/join?token=${invitedUserId}&email=${encodeURIComponent(email)}`
        );
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to send invitation email');
        }
        console.log(`✅ Invitation email sent successfully to ${email}`);
      } catch (emailError) {
        console.error("❌ Failed to send invitation email:", emailError);
        // Continue with user creation even if email fails, but inform frontend
        return res.status(201).json({
          message: `User invited but email delivery failed. Please contact the user directly.`,
          user: {
            ...newUser,
            userRoles: await storage.getUserRoles(invitedUserId),
            projectRoles: projectAssignments
          },
          emailError: emailError instanceof Error ? emailError.message : 'Unknown email error'
        });
      }

      // Return the created user with assigned roles
      const userWithRoles = {
        ...newUser,
        userRoles: await storage.getUserRoles(invitedUserId),
        projectRoles: projectAssignments
      };

      res.status(201).json({
        message: `Invitation sent to ${email}`,
        user: userWithRoles
      });
    } catch (error) {
      console.error("Error inviting user:", error);
      res.status(500).json({ message: "Failed to send user invitation" });
    }
  });

  // Test email endpoint - for debugging email service
  app.post('/api/admin/test-email', isAuthenticated, async (req: any, res) => {
    try {
      const { email } = req.body;
      const currentUser = req.user?.claims;
      
      if (!email) {
        return res.status(400).json({ message: 'Email address is required' });
      }

      // Auto-detect the base URL
      const baseUrl = process.env.BASE_URL || 
                     (process.env.REPLIT_CLUSTER ? `https://${process.env.REPL_SLUG}.${process.env.REPLIT_CLUSTER}.replit.app` : 'http://localhost:5000');

      await emailService.sendInvitationEmail(email, {
        inviterName: currentUser?.email?.split('@')[0] || 'Test Admin',
        organizationName: 'Ambersand Compliance (Test)',
        personalMessage: 'This is a test email to verify the email service is working correctly.',
        inviteUrl: `${baseUrl}/test-invite`
      });

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
  app.get('/api/dashboard/metrics', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      const metrics = await storage.getDashboardMetrics(user?.organizationId || undefined);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  // Projects routes
  app.get('/api/projects', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      const projects = await storage.getProjects(user?.organizationId || undefined);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get('/api/projects/:id', isAuthenticated, async (req, res) => {
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

  app.post('/api/projects', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log("Creating project for user:", userId);
      console.log("Request body:", JSON.stringify(req.body, null, 2));
      
      const user = await storage.getUser(userId);
      console.log("User found:", user ? "yes" : "no");
      
      // Extract controlIds from the request body
      const { controlIds, ...projectBody } = req.body;
      console.log("Extracted controlIds:", controlIds);
      console.log("Project body:", projectBody);
      
      const projectData = insertProjectSchema.parse({
        ...projectBody,
        organizationId: user?.organizationId,
      });
      console.log("Parsed project data:", projectData);
      
      const project = await storage.createProject(projectData);
      console.log("Project created with ID:", project.id);
      
      // Add controls to the project if provided
      if (controlIds && Array.isArray(controlIds) && controlIds.length > 0) {
        console.log("Adding", controlIds.length, "controls to project");
        await storage.addControlsToProject(project.id, controlIds);
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

  app.put('/api/projects/:id', isAuthenticated, async (req, res) => {
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

  app.delete('/api/projects/:id', isAuthenticated, async (req, res) => {
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
  app.get('/api/projects/:id/controls', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const controls = await storage.getProjectControls(projectId);
      res.json(controls);
    } catch (error) {
      console.error("Error fetching project controls:", error);
      res.status(500).json({ message: "Failed to fetch project controls" });
    }
  });

  app.post('/api/projects/:id/controls', isAuthenticated, async (req: any, res) => {
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

  app.delete('/api/projects/:projectId/controls/:controlId', isAuthenticated, async (req: any, res) => {
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

  // Tasks routes
  app.get('/api/tasks', isAuthenticated, async (req, res) => {
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

  app.get('/api/tasks/:id', isAuthenticated, async (req, res) => {
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

  app.post('/api/tasks', isAuthenticated, async (req: any, res) => {
    try {
      const taskData = insertTaskSchema.parse({
        ...req.body,
        createdById: req.user.claims.sub,
      });
      
      const task = await storage.createTask(taskData);
      
      // Send email notification if task is assigned to someone (including self)
      console.log('📧 Email check:', { 
        taskAssigneeId: task.assigneeId, 
        currentUserId: req.user.claims.sub,
        shouldSendEmail: !!task.assigneeId
      });
      
      if (task.assigneeId) {
        console.log('📧 Attempting to send task assignment email...');
        try {
          const assignedUser = await storage.getUser(task.assigneeId);
          const project = task.projectId ? await storage.getProject(task.projectId) : null;
          
          if (assignedUser && assignedUser.email) {
            const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Not set';
            const projectName = project?.name || 'Untitled Project';
            const template = emailService.templates.taskAssignment(
              assignedUser.firstName || assignedUser.name || 'User',
              task.title,
              dueDate,
              projectName,
              (assignedUser.language as 'en' | 'ar') || 'en',
              task.id
            );
            
            await emailService.sendEmail({
              to: assignedUser.email,
              subject: template.subject,
              html: template.html,
            });
            
            console.log(`✅ Task assignment email sent successfully to ${assignedUser.email}`);
          } else {
            console.log('❌ No email sent: Missing assigned user or email address');
          }
        } catch (emailError) {
          console.error('❌ Failed to send task assignment email:', emailError);
          // Don't fail the task creation if email fails
        }
      } else {
        console.log('🔄 No email sent: Task not assigned to any user');
      }
      
      res.status(201).json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  app.put('/api/tasks/:id', isAuthenticated, async (req, res) => {
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
            const template = emailService.templates.statusUpdate(
              assignedUser.firstName || assignedUser.name || 'User',
              task.title,
              oldTask.status,
              taskData.status,
              (assignedUser.language as 'en' | 'ar') || 'en'
            );
            
            await emailService.sendEmail({
              to: assignedUser.email,
              subject: template.subject,
              html: template.html,
            });
            
            console.log(`Task status update email sent to ${assignedUser.email}`);
          }
        }
        
        // Check for new assignment (including self-assignment)
        console.log('📧 Assignment check:', { 
          newAssigneeId: taskData.assigneeId, 
          oldAssigneeId: oldTask?.assigneeId,
          currentUserId: req.user?.id || (req.user as any)?.claims?.sub,
          isNewAssignment: taskData.assigneeId && oldTask?.assigneeId !== taskData.assigneeId
        });
        
        if (taskData.assigneeId && oldTask?.assigneeId !== taskData.assigneeId) {
          console.log('📧 Attempting to send task reassignment email...');
          const assignedUser = await storage.getUser(taskData.assigneeId);
          const project = task.projectId ? await storage.getProject(task.projectId) : null;
          
          if (assignedUser && assignedUser.email) {
            const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Not set';
            const projectName = project?.name || 'Untitled Project';
            const template = emailService.templates.taskAssignment(
              assignedUser.firstName || assignedUser.name || 'User',
              task.title,
              dueDate,
              projectName,
              (assignedUser.language as 'en' | 'ar') || 'en',
              task.id
            );
            
            await emailService.sendEmail({
              to: assignedUser.email,
              subject: template.subject,
              html: template.html,
            });
            
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

  app.delete('/api/tasks/:id', isAuthenticated, async (req, res) => {
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
  app.get('/api/tasks/:id/controls', isAuthenticated, async (req, res) => {
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
  app.get('/api/tasks/controls/all', isAuthenticated, async (req, res) => {
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
  app.get('/api/evidence/task/:taskId', isAuthenticated, async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const evidence = await storage.getEvidenceByTaskId(taskId);
      res.json(evidence);
    } catch (error) {
      console.error("Error fetching task evidence:", error);
      res.status(500).json({ message: "Failed to fetch task evidence" });
    }
  });

  app.post('/api/tasks/:id/controls', isAuthenticated, async (req, res) => {
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

  app.delete('/api/tasks/:id/controls', isAuthenticated, async (req, res) => {
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

  // ECC Controls routes
  app.get('/api/ecc-controls', isAuthenticated, async (req, res) => {
    try {
      const search = req.query.search as string | undefined;
      const controls = await storage.getEccControls(search);
      res.json(controls);
    } catch (error) {
      console.error("Error fetching ECC controls:", error);
      res.status(500).json({ message: "Failed to fetch ECC controls" });
    }
  });

  app.get('/api/ecc-controls/:id', isAuthenticated, async (req, res) => {
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

  // Evidence routes
  app.get('/api/evidence', isAuthenticated, async (req, res) => {
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

  app.post('/api/evidence', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // If evidence is uploaded to a task, get the first control associated with that task
      let controlId = req.body.eccControlId ? parseInt(req.body.eccControlId) : undefined;
      const taskId = req.body.taskId ? parseInt(req.body.taskId) : undefined;
      
      if (taskId && !controlId) {
        try {
          const taskControls = await storage.getTaskControls(taskId);
          if (taskControls.length > 0) {
            controlId = taskControls[0].eccControl.id;
            console.log(`🔗 Auto-assigning control ${controlId} to evidence from task ${taskId}`);
          }
        } catch (error) {
          console.log('⚠️ Could not retrieve task controls:', error);
        }
      }

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
        projectId: req.body.projectId ? parseInt(req.body.projectId) : undefined,
        eccControlId: controlId,
        uploadedById: req.user.claims.sub,
      });
      
      const evidence = await storage.createEvidence(evidenceData);
      res.status(201).json(evidence);
    } catch (error) {
      console.error("Error uploading evidence:", error);
      res.status(500).json({ message: "Failed to upload evidence" });
    }
  });

  app.get('/api/evidence/:id', isAuthenticated, async (req, res) => {
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

  app.put('/api/evidence/:id', isAuthenticated, async (req, res) => {
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

  app.delete('/api/evidence/:id', isAuthenticated, async (req, res) => {
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
  app.get('/api/evidence/:id/versions', isAuthenticated, async (req, res) => {
    try {
      const evidenceId = parseInt(req.params.id);
      const versions = await storage.getEvidenceVersions(evidenceId);
      res.json(versions);
    } catch (error) {
      console.error("Error fetching evidence versions:", error);
      res.status(500).json({ message: "Failed to fetch evidence versions" });
    }
  });

  app.post('/api/evidence/:id/versions', isAuthenticated, upload.single('file'), async (req: any, res) => {
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
        uploadedById: req.user.claims.sub,
      };

      const version = await storage.createEvidenceVersion(versionData);
      res.status(201).json(version);
    } catch (error) {
      console.error("Error creating evidence version:", error);
      res.status(500).json({ message: "Failed to create evidence version" });
    }
  });

  // Evidence Comments routes
  app.get('/api/evidence/:id/comments', isAuthenticated, async (req, res) => {
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
  app.get('/api/evidence/control/:controlId', isAuthenticated, async (req, res) => {
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
  app.get('/api/evidence/versions/:taskId', isAuthenticated, async (req, res) => {
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
  app.get('/api/evidence/comments/:taskId', isAuthenticated, async (req, res) => {
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
  app.post('/api/evidence/:id/comments', isAuthenticated, async (req: any, res) => {
    try {
      const evidenceId = parseInt(req.params.id);
      const { comment, isSystemComment, commentType } = req.body;
      
      if (!comment || comment.trim() === '') {
        return res.status(400).json({ message: "Comment content is required" });
      }
      
      const commentData = {
        evidenceId,
        userId: req.user.claims.sub,
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
  app.get('/api/evidence/:id/controls', isAuthenticated, async (req, res) => {
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
  app.get('/api/controls/:controlId/evidence', isAuthenticated, async (req, res) => {
    try {
      const controlId = parseInt(req.params.controlId);
      const evidenceList = await storage.getControlLinkedEvidence(controlId);
      res.json(evidenceList);
    } catch (error) {
      console.error("Error fetching control evidence:", error);
      res.status(500).json({ message: "Failed to fetch control evidence" });
    }
  });

  app.post('/api/evidence/:id/controls', isAuthenticated, async (req, res) => {
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

  app.delete('/api/evidence/:id/controls', isAuthenticated, async (req, res) => {
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
  app.get('/api/evidence/:id/tasks', isAuthenticated, async (req, res) => {
    try {
      const evidenceId = parseInt(req.params.id);
      const tasks = await storage.getEvidenceTasks(evidenceId);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching evidence tasks:", error);
      res.status(500).json({ message: "Failed to fetch evidence tasks" });
    }
  });

  app.post('/api/evidence/:id/tasks', isAuthenticated, async (req, res) => {
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

  app.delete('/api/evidence/:id/tasks', isAuthenticated, async (req, res) => {
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

  // Custom Regulations routes
  app.get('/api/custom-regulations', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      const regulations = await storage.getCustomRegulations(user?.organizationId || undefined);
      res.json(regulations);
    } catch (error) {
      console.error("Error fetching custom regulations:", error);
      res.status(500).json({ message: "Failed to fetch custom regulations" });
    }
  });

  app.get('/api/custom-regulations/:id', isAuthenticated, async (req, res) => {
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

  app.post('/api/custom-regulations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  app.put('/api/custom-regulations/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const regulation = await storage.updateCustomRegulation(id, req.body);
      res.json(regulation);
    } catch (error) {
      console.error("Error updating custom regulation:", error);
      res.status(500).json({ message: "Failed to update custom regulation" });
    }
  });

  app.delete('/api/custom-regulations/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCustomRegulation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting custom regulation:", error);
      res.status(500).json({ message: "Failed to delete custom regulation" });
    }
  });

  // Custom Controls routes
  app.get('/api/custom-controls', isAuthenticated, async (req, res) => {
    try {
      const regulationId = req.query.regulationId ? parseInt(req.query.regulationId as string) : undefined;
      const controls = await storage.getCustomControls(regulationId);
      res.json(controls);
    } catch (error) {
      console.error("Error fetching custom controls:", error);
      res.status(500).json({ message: "Failed to fetch custom controls" });
    }
  });

  app.post('/api/custom-controls', isAuthenticated, async (req, res) => {
    try {
      const control = await storage.createCustomControl(req.body);
      res.status(201).json(control);
    } catch (error) {
      console.error("Error creating custom control:", error);
      res.status(500).json({ message: "Failed to create custom control" });
    }
  });

  app.put('/api/custom-controls/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const control = await storage.updateCustomControl(id, req.body);
      res.json(control);
    } catch (error) {
      console.error("Error updating custom control:", error);
      res.status(500).json({ message: "Failed to update custom control" });
    }
  });

  app.delete('/api/custom-controls/:id', isAuthenticated, async (req, res) => {
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
  app.get('/api/projects/:projectId/regulations/:regulationId/domains', isAuthenticated, async (req, res) => {
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
          .map(pc => pc.eccControlId)
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
  app.post('/api/test-email', isAuthenticated, async (req: any, res) => {
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
  app.post('/api/evidence/upload', isAuthenticated, upload.array('files', 10), async (req: any, res) => {
    try {
      console.log('Evidence upload request received:', {
        body: req.body,
        filesCount: req.files?.length || 0,
        user: req.user?.claims?.sub
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
            uploadedById: req.user.claims.sub,
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
              userId: req.user.claims.sub,
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
            eccControlId: controlId || undefined,
            title: file.originalname,
            titleAr: file.originalname,
            fileName: file.originalname,
            filePath: file.path,
            fileSize: file.size,
            fileType: file.mimetype,
            description: `Evidence file: ${file.originalname}`,
            descriptionAr: `ملف أدلة: ${file.originalname}`,
            uploadedById: req.user.claims.sub,
          };
          
          console.log('Creating evidence record:', evidenceData);
          const evidence = await storage.createEvidence(evidenceData);
          
          // Associate evidence with control if provided
          if (controlId) {
            await storage.addControlsToEvidence(evidence.id, [controlId]);
          }
          
          // Associate evidence with task if provided
          if (taskId) {
            await storage.addTasksToEvidence(evidence.id, [taskId]);
          }
          
          // Add comment if provided
          if (comment) {
            await storage.createEvidenceComment({
              evidenceId: evidence.id,
              userId: req.user.claims.sub,
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

  // Serve uploaded files
  app.get('/api/evidence/:id/download', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const evidence = await storage.getEvidence();
      const evidenceItem = evidence.find(e => e.id === id);
      
      if (!evidenceItem) {
        return res.status(404).json({ message: "Evidence not found" });
      }

      res.download(evidenceItem.filePath, evidenceItem.fileName);
    } catch (error) {
      console.error("Error downloading evidence:", error);
      res.status(500).json({ message: "Failed to download evidence" });
    }
  });

  // Serve uploaded files (profile pictures and evidence)
  app.use('/uploads', (req, res, next) => {
    // Add CORS headers for uploaded files
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });
  app.use('/uploads', express.static(uploadDir));

  const httpServer = createServer(app);
  return httpServer;
}
