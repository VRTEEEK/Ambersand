import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, User, Building, Folder, Key } from 'lucide-react';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
}

interface Project {
  id: number;
  name: string;
  nameAr?: string;
}

interface EffectivePermissions {
  user: User;
  organization_roles: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  project_roles: Array<{
    id: string;
    code: string;
    name: string;
    project_id: number;
    project_name: string;
  }>;
  permissions: Array<{
    code: string;
    description: string;
    source: 'organization' | 'project';
  }>;
  project_context?: {
    id: number;
    name: string;
  };
}

interface PermissionsPreviewModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function PermissionsPreviewModal({ user, isOpen, onClose }: PermissionsPreviewModalProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // Fetch projects for the dropdown
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    enabled: isOpen && !!user,
  });

  // Fetch effective permissions for the user
  const { data: effectivePermissions, isLoading } = useQuery<EffectivePermissions>({
    queryKey: ['/api/users', user?.id, 'effective-permissions', selectedProjectId],
    queryFn: async () => {
      const url = selectedProjectId 
        ? `/api/users/${user?.id}/effective-permissions?project_id=${selectedProjectId}`
        : `/api/users/${user?.id}/effective-permissions`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch permissions');
      }
      return response.json();
    },
    enabled: isOpen && !!user?.id,
  });

  const getRoleBadgeVariant = (roleCode: string) => {
    const variants: Record<string, string> = {
      'admin': 'destructive',
      'user': 'default', 
      'officer': 'secondary',
      'collaborator': 'outline',
      'viewer': 'secondary'
    };
    return variants[roleCode] || 'outline';
  };

  const getPermissionBadgeVariant = (source: string) => {
    return source === 'organization' ? 'default' : 'secondary';
  };

  const userName = user ? (
    user.firstName && user.lastName 
      ? `${user.firstName} ${user.lastName}`
      : user.name || user.email
  ) : '';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Permissions Preview
          </DialogTitle>
          <DialogDescription>
            View effective permissions for {userName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Project Context Selector */}
          <div className="space-y-2">
            <Label>Project Context (Optional)</Label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select project to view project-specific permissions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Organization Permissions</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    {project.nameAr || project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-sm text-muted-foreground">Loading permissions...</div>
                </div>
              ) : effectivePermissions ? (
                <>
                  {/* Organization Roles */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        Organization Roles
                      </CardTitle>
                      <CardDescription>
                        System-wide roles that apply across the entire organization
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {effectivePermissions.organization_roles.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {effectivePermissions.organization_roles.map((role) => (
                            <Badge 
                              key={role.id} 
                              variant={getRoleBadgeVariant(role.code) as any}
                              className="flex items-center gap-1"
                            >
                              <User className="h-3 w-3" />
                              {role.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No organization roles assigned</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Project Roles */}
                  {selectedProjectId && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Folder className="h-4 w-4" />
                          Project Roles
                        </CardTitle>
                        <CardDescription>
                          Roles specific to {effectivePermissions.project_context?.name}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {effectivePermissions.project_roles.length > 0 ? (
                          <div className="space-y-2">
                            {effectivePermissions.project_roles.map((role) => (
                              <div key={`${role.project_id}-${role.id}`} className="flex items-center justify-between p-2 border rounded">
                                <div className="flex items-center gap-2">
                                  <Badge variant={getRoleBadgeVariant(role.code) as any}>
                                    {role.name}
                                  </Badge>
                                  <span className="text-sm text-muted-foreground">
                                    in {role.project_name}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No project roles assigned</p>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Effective Permissions */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        Effective Permissions
                        <Badge variant="outline" className="ml-auto">
                          {effectivePermissions.permissions.length}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        All permissions granted through assigned roles
                        {selectedProjectId && ` in project context`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {effectivePermissions.permissions.length > 0 ? (
                        <div className="grid gap-2">
                          {effectivePermissions.permissions.map((permission, index) => (
                            <div key={index} className="flex items-center justify-between p-2 border rounded-lg">
                              <div className="flex items-center gap-2">
                                <Key className="h-3 w-3 text-muted-foreground" />
                                <span className="font-medium text-sm">
                                  {permission.description || permission.code.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={getPermissionBadgeVariant(permission.source) as any} className="text-xs">
                                  {permission.source}
                                </Badge>
                                <Badge variant="outline" className="text-xs font-mono">
                                  {permission.code}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No permissions granted</p>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <div className="text-sm text-muted-foreground">Failed to load permissions</div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}