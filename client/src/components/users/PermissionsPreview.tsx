import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useI18n } from '@/hooks/use-i18n';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Shield } from 'lucide-react';
import { useEffect } from 'react';

interface EffectivePermissions {
  roles: {
    org: string[];
    project: string[];
  };
  permissions: string[];
}

interface PermissionsPreviewProps {
  userId: string;
  orgRoles: string[];
  projectId?: string;
  projectRoles: string[];
  mode?: 'live' | 'saved';
}

export default function PermissionsPreview({ 
  userId, 
  orgRoles, 
  projectId, 
  projectRoles,
  mode = 'live'
}: PermissionsPreviewProps) {
  const { t } = useI18n();

  // Live preview using mutation for staged changes
  const previewMutation = useMutation({
    mutationFn: (body: {
      org_roles: string[];
      project_id?: string;
      project_roles: string[];
    }) => apiRequest(`/api/users/${userId}/effective-permissions/preview`, 'POST', body),
  });

  // Fallback to saved permissions
  const { data: savedPermissions, isLoading: loadingSaved } = useQuery<EffectivePermissions>({
    queryKey: ['/api/users', userId, 'effective-permissions', projectId],
    queryFn: () => {
      const params = projectId && projectId !== 'org' ? `?project_id=${projectId}` : '';
      return fetch(`/api/users/${userId}/effective-permissions${params}`).then(res => res.json());
    },
    enabled: !!userId && mode === 'saved',
  });

  // Trigger preview on changes with debounce
  useEffect(() => {
    if (mode !== 'live' || !userId) return;
    
    const timeoutId = setTimeout(() => {
      const body = {
        org_roles: orgRoles,
        project_id: projectId === 'org' ? undefined : projectId,
        project_roles: projectId === 'org' ? [] : projectRoles,
      };
      previewMutation.mutate(body);
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [orgRoles, projectRoles, projectId, userId, mode]);

  const effectivePermissions = mode === 'live' ? previewMutation.data : savedPermissions;
  const isLoading = mode === 'live' ? previewMutation.isPending : loadingSaved;

  const getPermissionDisplayName = (permission: string) => {
    const permissionNames = {
      'view_regulations': t('permissions.viewRegulations'),
      'create_projects': t('permissions.createProjects'),
      'edit_projects': t('permissions.editProjects'),
      'delete_projects': t('permissions.deleteProjects'),
      'manage_tasks': t('permissions.manageTasks'),
      'upload_evidence': t('permissions.uploadEvidence'),
      'review_evidence': t('permissions.reviewEvidence'),
      'change_user_permissions': t('permissions.changeUserPermissions'),
      'view_audit_logs': t('permissions.viewAuditLogs'),
      'manage_system_settings': t('permissions.manageSystemSettings'),
    };
    return permissionNames[permission as keyof typeof permissionNames] || permission;
  };

  const getRoleDisplayName = (roleCode: string) => {
    const roleNames = {
      'admin': t('roles.admin'),
      'user': t('roles.user'),
      'officer': t('roles.officer'), 
      'collaborator': t('roles.collaborator'),
      'viewer': t('roles.viewer')
    };
    return roleNames[roleCode as keyof typeof roleNames] || roleCode;
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5" />
          {t('users.effectivePermissions')}
        </CardTitle>
        <CardDescription>
          {mode === 'live' 
            ? t('users.livePermissionsPreview')
            : t('users.currentPermissions')
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : effectivePermissions ? (
          <>
            {/* Effective Roles */}
            <div>
              <h4 className="font-medium text-sm mb-2">{t('users.effectiveRoles')}</h4>
              <div className="space-y-2">
                {effectivePermissions.roles.org.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                      {t('users.organizationRoles')}:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {effectivePermissions.roles.org.map((role) => (
                        <Badge key={role} variant="secondary" className="text-xs">
                          {getRoleDisplayName(role)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {effectivePermissions.roles.project.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                      {t('users.projectRoles')}:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {effectivePermissions.roles.project.map((role) => (
                        <Badge key={role} variant="outline" className="text-xs">
                          {getRoleDisplayName(role)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Permissions */}
            <div>
              <h4 className="font-medium text-sm mb-2">
                {t('users.permissions')} ({effectivePermissions.permissions.length})
              </h4>
              <ScrollArea className="h-40">
                <div className="space-y-1">
                  {effectivePermissions.permissions.map((permission) => (
                    <div key={permission} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded text-xs">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      {getPermissionDisplayName(permission)}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-slate-500">
            {t('users.noPermissionsData')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}