import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/hooks/use-i18n';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, X, Users, Building, Eye, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  userRoles?: Role[];
}

interface Role {
  id: string;
  code: string;
  name: string;
}

interface Project {
  id: number;
  name: string;
  nameAr?: string;
}

interface UserProjectRole {
  projectId: number;
  projectName: string;
  roles: string[];
}

interface EffectivePermissions {
  roles: {
    org: string[];
    project: string[];
  };
  permissions: string[];
}

interface UserRolesDrawerProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function UserRolesDrawer({ user, isOpen, onClose }: UserRolesDrawerProps) {
  const { t, isRTL } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [orgRoles, setOrgRoles] = useState<string[]>([]);
  const [projectRoles, setProjectRoles] = useState<Record<string, string[]>>({});
  const [previewProjectId, setPreviewProjectId] = useState<string>('');

  // Fetch available roles
  const { data: availableRoles = [] } = useQuery<Role[]>({
    queryKey: ['/api/roles'],
  });

  // Fetch available projects
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Fetch user's current project roles
  const { data: userProjectRoles = [] } = useQuery<UserProjectRole[]>({
    queryKey: ['/api/users', user?.id, 'project-roles'],
    enabled: !!user?.id,
  });

  // Fetch effective permissions preview
  const { data: effectivePermissions, isLoading: loadingPermissions } = useQuery<EffectivePermissions>({
    queryKey: ['/api/users', user?.id, 'effective-permissions', previewProjectId],
    enabled: !!user?.id && !!previewProjectId,
  });

  // Initialize state when user changes
  useEffect(() => {
    if (user?.userRoles) {
      setOrgRoles(user.userRoles.map(r => r.code));
    }
    if (userProjectRoles) {
      const projectRoleMap: Record<string, string[]> = {};
      userProjectRoles.forEach(pr => {
        projectRoleMap[pr.projectId.toString()] = pr.roles;
      });
      setProjectRoles(projectRoleMap);
    }
  }, [user, userProjectRoles]);

  // Mutations
  const updateOrgRolesMutation = useMutation({
    mutationFn: ({ add, remove }: { add: string[]; remove: string[] }) =>
      apiRequest(`/api/users/${user?.id}/org-roles`, 'POST', { add, remove }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/me/permissions'] });
      toast({ 
        title: t('users.rolesUpdated'), 
        description: t('users.orgRolesUpdatedSuccess') 
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: t('users.roleUpdateError'),
        description: error.message || t('users.orgRolesUpdateError'),
      });
    },
  });

  const updateProjectRolesMutation = useMutation({
    mutationFn: ({ projectId, add, remove }: { projectId: string; add: string[]; remove: string[] }) =>
      apiRequest(`/api/users/${user?.id}/project-roles`, 'POST', { project_id: projectId, add, remove }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users', user?.id, 'project-roles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/me/permissions'] });
      toast({ 
        title: t('users.rolesUpdated'), 
        description: t('users.projectRolesUpdatedSuccess') 
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: t('users.roleUpdateError'),
        description: error.message || t('users.projectRolesUpdateError'),
      });
    },
  });

  const handleOrgRoleChange = (roleCode: string, checked: boolean) => {
    const newRoles = checked
      ? [...orgRoles, roleCode]
      : orgRoles.filter(r => r !== roleCode);
    setOrgRoles(newRoles);
  };

  const handleProjectRoleChange = (projectId: string, roleCode: string, checked: boolean) => {
    const currentRoles = projectRoles[projectId] || [];
    const newRoles = checked
      ? [...currentRoles, roleCode]
      : currentRoles.filter(r => r !== roleCode);
    
    setProjectRoles(prev => ({
      ...prev,
      [projectId]: newRoles
    }));
  };

  const handleSaveOrgRoles = () => {
    if (!user) return;
    
    const currentRoles = user.userRoles?.map(r => r.code) || [];
    const add = orgRoles.filter(r => !currentRoles.includes(r));
    const remove = currentRoles.filter(r => !orgRoles.includes(r));
    
    updateOrgRolesMutation.mutate({ add, remove });
  };

  const handleSaveProjectRoles = (projectId: string) => {
    const currentRoles = userProjectRoles.find(pr => pr.projectId.toString() === projectId)?.roles || [];
    const newRoles = projectRoles[projectId] || [];
    
    const add = newRoles.filter(r => !currentRoles.includes(r));
    const remove = currentRoles.filter(r => !newRoles.includes(r));
    
    updateProjectRolesMutation.mutate({ projectId, add, remove });
  };

  const getRoleBadgeVariant = (roleCode: string) => {
    const variants = {
      'admin': 'destructive',
      'user': 'default', 
      'officer': 'secondary',
      'collaborator': 'outline',
      'viewer': 'secondary'
    };
    return variants[roleCode as keyof typeof variants] || 'outline';
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

  if (!user) return null;

  return (
    <Sheet open={isOpen} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t('users.editRoles')}
          </SheetTitle>
          <SheetDescription>
            {t('users.editRolesDescription', { 
              name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email 
            })}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          <Tabs defaultValue="organization" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="organization" className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                {t('users.orgRoles')}
              </TabsTrigger>
              <TabsTrigger value="projects" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {t('users.projectRoles')}
              </TabsTrigger>
              <TabsTrigger value="permissions" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                {t('users.permissions')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="organization" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t('users.organizationRoles')}</CardTitle>
                  <CardDescription>
                    {t('users.orgRolesDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    {availableRoles.map((role) => (
                      <div key={role.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                        <Checkbox
                          checked={orgRoles.includes(role.code)}
                          onCheckedChange={(checked) => handleOrgRoleChange(role.code, !!checked)}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{getRoleDisplayName(role.code)}</span>
                            <Badge variant={getRoleBadgeVariant(role.code)}>
                              {role.code}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {t(`roles.${role.code}Description`)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button 
                    onClick={handleSaveOrgRoles}
                    disabled={updateOrgRolesMutation.isPending}
                    className="w-full"
                  >
                    {updateOrgRolesMutation.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {t('users.saveOrgRoles')}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="projects" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t('users.projectRoles')}</CardTitle>
                  <CardDescription>
                    {t('users.projectRolesDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('users.selectProject')} />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          {isRTL ? project.nameAr || project.name : project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedProjectId && (
                    <div className="space-y-4">
                      <div className="grid gap-3">
                        {availableRoles.map((role) => (
                          <div key={role.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                            <Checkbox
                              checked={projectRoles[selectedProjectId]?.includes(role.code) || false}
                              onCheckedChange={(checked) => handleProjectRoleChange(selectedProjectId, role.code, !!checked)}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{getRoleDisplayName(role.code)}</span>
                                <Badge variant={getRoleBadgeVariant(role.code)}>
                                  {role.code}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Button 
                        onClick={() => handleSaveProjectRoles(selectedProjectId)}
                        disabled={updateProjectRolesMutation.isPending}
                        className="w-full"
                      >
                        {updateProjectRolesMutation.isPending && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        {t('users.saveProjectRoles')}
                      </Button>
                    </div>
                  )}

                  {/* Existing Project Roles */}
                  {userProjectRoles.length > 0 && (
                    <div className="space-y-2">
                      <Separator />
                      <h4 className="font-medium">{t('users.currentProjectRoles')}</h4>
                      <ScrollArea className="h-32">
                        <div className="space-y-2">
                          {userProjectRoles.map((pr) => (
                            <div key={pr.projectId} className="flex items-center justify-between p-2 border rounded">
                              <span className="text-sm font-medium">{pr.projectName}</span>
                              <div className="flex gap-1">
                                {pr.roles.map((roleCode) => (
                                  <Badge key={roleCode} variant={getRoleBadgeVariant(roleCode)} className="text-xs">
                                    {roleCode}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="permissions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t('users.effectivePermissions')}</CardTitle>
                  <CardDescription>
                    {t('users.effectivePermissionsDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select value={previewProjectId} onValueChange={setPreviewProjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('users.selectProjectPreview')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">{t('users.organizationLevel')}</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          {isRTL ? project.nameAr || project.name : project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {loadingPermissions ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : effectivePermissions ? (
                    <div className="space-y-4">
                      <div>
                        <h5 className="font-medium mb-2">{t('users.roles')}</h5>
                        <div className="space-y-2">
                          <div>
                            <span className="text-sm text-muted-foreground">{t('users.orgRoles')}:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {effectivePermissions.roles.org.map((role) => (
                                <Badge key={role} variant={getRoleBadgeVariant(role)}>
                                  {role}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          {effectivePermissions.roles.project.length > 0 && (
                            <div>
                              <span className="text-sm text-muted-foreground">{t('users.projectRoles')}:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {effectivePermissions.roles.project.map((role) => (
                                  <Badge key={role} variant={getRoleBadgeVariant(role)}>
                                    {role}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div>
                        <h5 className="font-medium mb-2">{t('users.permissions')}</h5>
                        <ScrollArea className="h-48">
                          <div className="grid gap-1">
                            {effectivePermissions.permissions.map((permission) => (
                              <div key={permission} className="text-sm p-2 bg-muted rounded">
                                {t(`permissions.${permission}`, permission)}
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      {t('users.selectProjectToPreview')}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}