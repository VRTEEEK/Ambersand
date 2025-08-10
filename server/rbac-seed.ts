import { db } from "./db";
import { 
  roles, 
  permissions, 
  rolePermissions,
  userRoles,
  userProjectRoles,
  type InsertRole,
  type InsertPermission,
  type InsertRolePermission,
  type InsertUserRole
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

// Permission definitions from Excel file
const permissionDefinitions: InsertPermission[] = [
  { code: "view_regulations", description: "View regulations and compliance frameworks" },
  { code: "create_projects_from_regulations", description: "Create new projects based on regulatory frameworks" },
  { code: "assign_projects_to_users", description: "Assign projects and tasks to team members" },
  { code: "change_organization_settings", description: "Modify organization-wide settings and configurations" },
  { code: "change_user_permissions", description: "Manage user roles and permissions" },
  { code: "create_tasks", description: "Create and manage compliance tasks" },
  { code: "create_risks", description: "Create and manage compliance risks" },
  { code: "review_evidences_submitted", description: "Review and validate submitted evidence" },
  { code: "view_evidence_repository", description: "Access and browse the evidence repository" },
  { code: "edit_evidence_repository", description: "Edit and manage evidence files and metadata" },
  { code: "approve_controls", description: "Approve compliance control implementations" },
];

// Role definitions
const roleDefinitions: InsertRole[] = [
  { code: "admin", name: "Administrator" },
  { code: "user", name: "User" },
  { code: "officer", name: "Compliance Officer" },
  { code: "collaborator", name: "Collaborator" },
  { code: "viewer", name: "Viewer" },
];

// Permission matrix from Excel file
const permissionMatrix: Record<string, string[]> = {
  admin: [
    "view_regulations",
    "create_projects_from_regulations",
    "assign_projects_to_users",
    "change_organization_settings",
    "change_user_permissions",
    "create_tasks",
    "create_risks",
    "review_evidences_submitted",
    "view_evidence_repository",
    "edit_evidence_repository",
    "approve_controls"
  ],
  user: [
    "view_regulations",
    "create_projects_from_regulations",
    "assign_projects_to_users",
    "create_tasks",
    "create_risks",
    "review_evidences_submitted",
    "view_evidence_repository",
    "edit_evidence_repository"
  ],
  officer: [
    "approve_controls"
  ],
  collaborator: [
    "view_regulations",
    "review_evidences_submitted",
    "view_evidence_repository"
  ],
  viewer: [
    "view_regulations",
    "review_evidences_submitted",
    "view_evidence_repository"
  ]
};

export async function seedRBAC() {
  try {
    console.log("🌱 Seeding RBAC system...");

    // 1. Seed roles (idempotent)
    console.log("📝 Seeding roles...");
    for (const roleData of roleDefinitions) {
      await db.insert(roles)
        .values(roleData)
        .onConflictDoNothing();
    }

    // 2. Seed permissions (idempotent)
    console.log("🔐 Seeding permissions...");
    for (const permissionData of permissionDefinitions) {
      await db.insert(permissions)
        .values(permissionData)
        .onConflictDoNothing();
    }

    // 3. Get all roles and permissions for mapping
    const allRoles = await db.select().from(roles);
    const allPermissions = await db.select().from(permissions);

    // 4. Create role-permission mappings
    console.log("🔗 Creating role-permission mappings...");
    for (const [roleCode, permissionCodes] of Object.entries(permissionMatrix)) {
      const role = allRoles.find(r => r.code === roleCode);
      if (!role) {
        console.warn(`Role ${roleCode} not found`);
        continue;
      }

      for (const permissionCode of permissionCodes) {
        const permission = allPermissions.find(p => p.code === permissionCode);
        if (!permission) {
          console.warn(`Permission ${permissionCode} not found`);
          continue;
        }

        const rolePermissionData: InsertRolePermission = {
          roleId: role.id,
          permissionId: permission.id
        };

        await db.insert(rolePermissions)
          .values(rolePermissionData)
          .onConflictDoNothing();
      }
    }

    // 5. Assign admin role to first user if no roles exist
    const existingUserRoles = await db.select().from(userRoles).limit(1);
    if (existingUserRoles.length === 0) {
      console.log("👤 Assigning admin role to first user...");
      const users = await db.query.users.findMany({ limit: 1 });
      const adminRole = allRoles.find(r => r.code === 'admin');
      
      if (users.length > 0 && adminRole) {
        const userRoleData: InsertUserRole = {
          userId: users[0].id,
          roleId: adminRole.id
        };
        
        await db.insert(userRoles)
          .values(userRoleData)
          .onConflictDoNothing();
        
        console.log(`✅ Admin role assigned to user ${users[0].email}`);
      }
    }

    console.log("✅ RBAC system seeded successfully!");
    
  } catch (error) {
    console.error("❌ Failed to seed RBAC system:", error);
    throw error;
  }
}

// Helper function to get user permissions
export async function getUserPermissions(userId: string, projectId?: number): Promise<string[]> {
  try {
    // Get org-level roles
    const orgRoles = await db.query.userRoles.findMany({
      where: eq(userRoles.userId, userId),
      with: {
        role: {
          with: {
            rolePermissions: {
              with: {
                permission: true
              }
            }
          }
        }
      }
    });

    let allPermissions = new Set<string>();

    // Add org-level permissions
    for (const userRole of orgRoles) {
      for (const rolePermission of userRole.role.rolePermissions) {
        allPermissions.add(rolePermission.permission.code);
      }
    }

    // Get project-level roles if project specified
    if (projectId) {
      const projectRoles = await db.query.userProjectRoles.findMany({
        where: and(
          eq(userProjectRoles.userId, userId),
          eq(userProjectRoles.projectId, projectId)
        ),
        with: {
          role: {
            with: {
              rolePermissions: {
                with: {
                  permission: true
                }
              }
            }
          }
        }
      });

      // Add project-level permissions
      for (const userProjectRole of projectRoles) {
        for (const rolePermission of userProjectRole.role.rolePermissions) {
          allPermissions.add(rolePermission.permission.code);
        }
      }
    }

    return Array.from(allPermissions);
  } catch (error) {
    console.error("Failed to get user permissions:", error);
    return [];
  }
}