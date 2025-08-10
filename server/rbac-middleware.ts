import { Request, Response, NextFunction } from "express";
import { getUserPermissions } from "./rbac-seed";

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: string;
        organizationId: string;
      };
    }
  }
}

export interface PermissionRequest extends Request {
  requiredPermissions?: string[];
  projectId?: number;
}

export function requirePermissions(permissionCodes: string[], requireProjectId: boolean = false) {
  return async (req: PermissionRequest, res: Response, next: NextFunction) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Get project ID from params or query if required
      let projectId: number | undefined;
      if (requireProjectId) {
        projectId = parseInt(req.params.project_id || req.params.projectId || req.query.project_id as string);
        if (!projectId || isNaN(projectId)) {
          return res.status(400).json({ message: "Project ID is required for this operation" });
        }
      }

      // Get user's effective permissions
      const userPermissions = await getUserPermissions(req.user.id, projectId);

      // Check if user has all required permissions
      const missingPermissions = permissionCodes.filter(perm => !userPermissions.includes(perm));
      
      if (missingPermissions.length > 0) {
        return res.status(403).json({ 
          message: "Insufficient permissions",
          missing: missingPermissions,
          required: permissionCodes
        });
      }

      // Store permissions for potential use in route handlers
      req.requiredPermissions = permissionCodes;
      req.projectId = projectId;

      next();
    } catch (error) {
      console.error("Permission check failed:", error);
      return res.status(500).json({ message: "Permission check failed" });
    }
  };
}

// Convenience functions for common permission patterns
export const requireViewRegulations = () => requirePermissions(["view_regulations"]);
export const requireCreateProjects = () => requirePermissions(["create_projects_from_regulations"]);
export const requireAssignProjects = (withProject = false) => requirePermissions(["assign_projects_to_users"], withProject);
export const requireCreateTasks = () => requirePermissions(["create_tasks"]);
export const requireCreateRisks = () => requirePermissions(["create_risks"]);
export const requireViewEvidence = () => requirePermissions(["view_evidence_repository"]);
export const requireEditEvidence = () => requirePermissions(["edit_evidence_repository"]);
export const requireReviewEvidence = () => requirePermissions(["review_evidences_submitted"]);
export const requireApproveControls = (withProject = true) => requirePermissions(["approve_controls"], withProject);
export const requireOrgSettings = () => requirePermissions(["change_organization_settings"]);
export const requireUserPermissions = () => requirePermissions(["change_user_permissions"]);

// Multi-permission checks
export const requireEvidenceAccess = () => requirePermissions(["view_evidence_repository", "review_evidences_submitted"]);
export const requireProjectManagement = () => requirePermissions(["create_projects_from_regulations", "assign_projects_to_users"]);
export const requireAdminAccess = () => requirePermissions(["change_organization_settings", "change_user_permissions"]);