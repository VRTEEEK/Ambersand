import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';

interface PermissionsContextType {
  permissions: string[];
  isLoading: boolean;
  can: (permission: string) => boolean;
  canAny: (permissions: string[]) => boolean;
  canAll: (permissions: string[]) => boolean;
  refreshPermissions: () => void;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

interface PermissionsProviderProps {
  children: ReactNode;
  projectId?: number;
}

export function PermissionsProvider({ children, projectId }: PermissionsProviderProps) {
  const { isAuthenticated } = useAuth();
  
  const { data, isLoading, refetch } = useQuery<{ permissions: string[]; projectId?: number }>({
    queryKey: ['/api/me/permissions', projectId],
    enabled: isAuthenticated,
  });

  const permissions = data?.permissions || [];

  const can = (permission: string): boolean => {
    return permissions.includes(permission);
  };

  const canAny = (perms: string[]): boolean => {
    return perms.some(perm => permissions.includes(perm));
  };

  const canAll = (perms: string[]): boolean => {
    return perms.every(perm => permissions.includes(perm));
  };

  const refreshPermissions = () => {
    refetch();
  };

  return (
    <PermissionsContext.Provider value={{ 
      permissions, 
      isLoading, 
      can, 
      canAny, 
      canAll, 
      refreshPermissions 
    }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions(): PermissionsContextType {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}

// Convenience hooks for common permission patterns
export function useCan(permission: string): boolean {
  const { can } = usePermissions();
  return can(permission);
}

export function useCanAny(permissions: string[]): boolean {
  const { canAny } = usePermissions();
  return canAny(permissions);
}

export function useCanAll(permissions: string[]): boolean {
  const { canAll } = usePermissions();
  return canAll(permissions);
}

// Permission constants matching backend
export const PERMISSIONS = {
  VIEW_REGULATIONS: 'view_regulations',
  CREATE_PROJECTS_FROM_REGULATIONS: 'create_projects_from_regulations',
  ASSIGN_PROJECTS_TO_USERS: 'assign_projects_to_users',
  CHANGE_ORGANIZATION_SETTINGS: 'change_organization_settings',
  CHANGE_USER_PERMISSIONS: 'change_user_permissions',
  CREATE_TASKS: 'create_tasks',
  CREATE_RISKS: 'create_risks',
  REVIEW_EVIDENCES_SUBMITTED: 'review_evidences_submitted',
  VIEW_EVIDENCE_REPOSITORY: 'view_evidence_repository',
  EDIT_EVIDENCE_REPOSITORY: 'edit_evidence_repository',
  APPROVE_CONTROLS: 'approve_controls',
} as const;