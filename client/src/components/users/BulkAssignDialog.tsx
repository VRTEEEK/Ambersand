import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/hooks/use-i18n';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Loader2, Users } from 'lucide-react';

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

interface BulkAssignDialogProps {
  selectedUserIds: string[];
  isOpen: boolean;
  onClose: () => void;
}

export default function BulkAssignDialog({ selectedUserIds, isOpen, onClose }: BulkAssignDialogProps) {
  const { t, isRTL } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [operation, setOperation] = useState<'add' | 'remove'>('add');
  const [selectedOrgRoles, setSelectedOrgRoles] = useState<string[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedProjectRoles, setSelectedProjectRoles] = useState<string[]>([]);

  // Fetch available roles and projects
  const { data: availableRoles = [] } = useQuery<Role[]>({
    queryKey: ['/api/roles'],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Bulk role assignment mutation
  const bulkAssignMutation = useMutation({
    mutationFn: (data: {
      user_ids: string[];
      org_roles?: { add?: string[]; remove?: string[] };
      project_roles?: { project_id: string; add?: string[]; remove?: string[] };
    }) => apiRequest('/api/admin/users/bulk-assign', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/me/permissions'] });
      toast({ 
        title: t('users.bulkAssignSuccess'), 
        description: t('users.bulkAssignSuccessDescription', { count: selectedUserIds.length })
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: t('users.bulkAssignError'),
        description: error.message || t('users.bulkAssignErrorDescription'),
      });
    },
  });

  const handleClose = () => {
    setOperation('add');
    setSelectedOrgRoles([]);
    setSelectedProjectId('');
    setSelectedProjectRoles([]);
    onClose();
  };

  const handleOrgRoleToggle = (roleCode: string) => {
    setSelectedOrgRoles(prev => 
      prev.includes(roleCode) 
        ? prev.filter(r => r !== roleCode)
        : [...prev, roleCode]
    );
  };

  const handleProjectRoleToggle = (roleCode: string) => {
    setSelectedProjectRoles(prev => 
      prev.includes(roleCode) 
        ? prev.filter(r => r !== roleCode)
        : [...prev, roleCode]
    );
  };

  const handleSubmit = () => {
    const data: {
      user_ids: string[];
      org_roles?: { add?: string[]; remove?: string[] };
      project_roles?: { project_id: string; add?: string[]; remove?: string[] };
    } = {
      user_ids: selectedUserIds,
    };

    if (selectedOrgRoles.length > 0) {
      data.org_roles = operation === 'add' 
        ? { add: selectedOrgRoles }
        : { remove: selectedOrgRoles };
    }

    if (selectedProjectId && selectedProjectRoles.length > 0) {
      data.project_roles = {
        project_id: selectedProjectId,
        ...(operation === 'add' 
          ? { add: selectedProjectRoles }
          : { remove: selectedProjectRoles }
        )
      };
    }

    bulkAssignMutation.mutate(data);
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

  const hasChanges = selectedOrgRoles.length > 0 || (selectedProjectId && selectedProjectRoles.length > 0);

  return (
    <Dialog open={isOpen} onOpenChange={() => handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('users.bulkAssignRoles')}
          </DialogTitle>
          <DialogDescription>
            {t('users.bulkAssignDescription', { count: selectedUserIds.length })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Operation Type */}
          <div className="space-y-2">
            <Label>{t('users.operation')}</Label>
            <Select value={operation} onValueChange={(value: 'add' | 'remove') => setOperation(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="add">{t('users.addRoles')}</SelectItem>
                <SelectItem value="remove">{t('users.removeRoles')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Organization Roles */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('users.organizationRoles')}</CardTitle>
              <CardDescription>
                {operation === 'add' 
                  ? t('users.selectRolesToAdd')
                  : t('users.selectRolesToRemove')
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {availableRoles.map((role) => (
                  <div key={role.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                    <Checkbox
                      checked={selectedOrgRoles.includes(role.code)}
                      onCheckedChange={() => handleOrgRoleToggle(role.code)}
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
            </CardContent>
          </Card>

          {/* Project Roles */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('users.projectRoles')}</CardTitle>
              <CardDescription>
                {t('users.optionalProjectRoles')}
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
                <div className="grid gap-3">
                  {availableRoles.map((role) => (
                    <div key={role.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                      <Checkbox
                        checked={selectedProjectRoles.includes(role.code)}
                        onCheckedChange={() => handleProjectRoleToggle(role.code)}
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
              )}
            </CardContent>
          </Card>

          {/* Impact Summary */}
          {hasChanges && (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-800">
                  <AlertTriangle className="h-4 w-4" />
                  {t('users.impactSummary')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-amber-700">
                  {t('users.bulkOperationImpact', { 
                    count: selectedUserIds.length,
                    operation: t(operation === 'add' ? 'users.add' : 'users.remove')
                  })}
                </p>
                
                {selectedOrgRoles.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-amber-800">
                      {t('users.orgRoles')}:
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedOrgRoles.map((roleCode) => (
                        <Badge key={roleCode} variant={getRoleBadgeVariant(roleCode)}>
                          {roleCode}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedProjectId && selectedProjectRoles.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-amber-800">
                      {t('users.projectRoles')} ({projects.find(p => p.id.toString() === selectedProjectId)?.name}):
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedProjectRoles.map((roleCode) => (
                        <Badge key={roleCode} variant={getRoleBadgeVariant(roleCode)}>
                          {roleCode}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!hasChanges || bulkAssignMutation.isPending}
          >
            {bulkAssignMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            {t('users.applyChanges')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}