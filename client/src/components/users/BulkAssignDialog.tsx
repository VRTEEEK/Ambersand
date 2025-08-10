import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Loader2, Users, Settings2, ChevronRight } from 'lucide-react';

interface Permission {
  id: string;
  code: string;
  name: string;
  type: 'role' | 'permission';
  category: string;
}

interface PermissionCategory {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
}

interface PermissionsResponse {
  categories: PermissionCategory[];
  permissions: any[];
  roles: any[];
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [operation, setOperation] = useState<'add' | 'remove'>('add');
  const [selectedPermissions, setSelectedPermissions] = useState<Record<string, string[]>>({});
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['org_roles']);

  // Fetch permissions with categories and projects
  const { data: permissionsData } = useQuery<PermissionsResponse>({
    queryKey: ['/api/permissions'],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Compute changes summary
  const changesSummary = useMemo(() => {
    const summary: Record<string, { category: string; permissions: Permission[] }> = {};
    
    Object.entries(selectedPermissions).forEach(([categoryId, permissionCodes]) => {
      if (permissionCodes.length > 0) {
        const category = permissionsData?.categories.find(c => c.id === categoryId);
        if (category) {
          summary[categoryId] = {
            category: category.name,
            permissions: category.permissions.filter(p => permissionCodes.includes(p.code))
          };
        }
      }
    });
    
    return summary;
  }, [selectedPermissions, permissionsData]);

  const hasChanges = Object.values(selectedPermissions).some(perms => perms.length > 0);

  // Bulk assignment mutation
  const bulkAssignMutation = useMutation({
    mutationFn: (data: {
      user_ids: string[];
      operation: 'add' | 'remove';
      categories: Record<string, {
        type: string;
        permissions: string[];
        project_id?: string;
      }>;
    }) => apiRequest('/api/admin/users/bulk-assign-permissions', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/me/permissions'] });
      toast({ 
        title: 'Bulk Assignment Complete',
        description: `Successfully ${operation === 'add' ? 'assigned' : 'removed'} permissions for ${selectedUserIds.length} users`
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Bulk Assignment Failed',
        description: error.message || 'Failed to update user permissions',
      });
    },
  });

  const handleClose = () => {
    setOperation('add');
    setSelectedPermissions({});
    setSelectedProjectId('');
    setExpandedCategories(['org_roles']);
    onClose();
  };

  const handlePermissionToggle = (categoryId: string, permissionCode: string) => {
    setSelectedPermissions(prev => {
      const categoryPerms = prev[categoryId] || [];
      const updated = categoryPerms.includes(permissionCode)
        ? categoryPerms.filter(p => p !== permissionCode)
        : [...categoryPerms, permissionCode];
      
      return {
        ...prev,
        [categoryId]: updated
      };
    });
  };

  const handleCategorySelectAll = (categoryId: string, checked: boolean) => {
    const category = permissionsData?.categories.find(c => c.id === categoryId);
    if (!category) return;

    setSelectedPermissions(prev => ({
      ...prev,
      [categoryId]: checked ? category.permissions.map(p => p.code) : []
    }));
  };

  const toggleCategoryExpanded = (categoryId: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSubmit = () => {
    const categoriesData: Record<string, { type: string; permissions: string[]; project_id?: string }> = {};
    
    Object.entries(selectedPermissions).forEach(([categoryId, permissionCodes]) => {
      if (permissionCodes.length > 0) {
        const category = permissionsData?.categories.find(c => c.id === categoryId);
        if (category) {
          categoriesData[categoryId] = {
            type: category.id === 'project_roles' ? 'project_role' : 'role',
            permissions: permissionCodes,
            ...(category.id === 'project_roles' && selectedProjectId ? { project_id: selectedProjectId } : {})
          };
        }
      }
    });

    bulkAssignMutation.mutate({
      user_ids: selectedUserIds,
      operation,
      categories: categoriesData
    });
  };

  const getRoleBadgeVariant = (code: string) => {
    const variants: Record<string, string> = {
      'admin': 'destructive',
      'user': 'default', 
      'officer': 'secondary',
      'collaborator': 'outline',
      'viewer': 'secondary'
    };
    return variants[code] || 'outline';
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Bulk Permission Assignment
          </DialogTitle>
          <DialogDescription>
            Manage permissions for {selectedUserIds.length} selected users. Changes will be applied to all selected users simultaneously.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-6 pr-4">
            {/* Operation Type */}
            <div className="space-y-2">
              <Label>Operation Type</Label>
              <Select value={operation} onValueChange={(value: 'add' | 'remove') => setOperation(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add Permissions</SelectItem>
                  <SelectItem value="remove">Remove Permissions</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Permission Categories */}
            {permissionsData?.categories.map((category) => {
              const isExpanded = expandedCategories.includes(category.id);
              const categoryPermissions = selectedPermissions[category.id] || [];
              const isAllSelected = categoryPermissions.length === category.permissions.length && category.permissions.length > 0;
              const isIndeterminate = categoryPermissions.length > 0 && categoryPermissions.length < category.permissions.length;

              return (
                <Card key={category.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleCategoryExpanded(category.id)}
                          className="h-6 w-6 p-0"
                        >
                          <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </Button>
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            {category.name}
                            {categoryPermissions.length > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {categoryPermissions.length}
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="text-sm">
                            {category.description}
                          </CardDescription>
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={isAllSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = isIndeterminate;
                            }}
                            onCheckedChange={(checked) => handleCategorySelectAll(category.id, checked as boolean)}
                          />
                          <Label className="text-xs text-muted-foreground">Select All</Label>
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="pt-0">
                      {/* Project Selection for Project Roles */}
                      {category.id === 'project_roles' && (
                        <div className="mb-4">
                          <Label className="text-sm font-medium">Target Project</Label>
                          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select project for role assignment" />
                            </SelectTrigger>
                            <SelectContent>
                              {projects.map((project) => (
                                <SelectItem key={project.id} value={project.id.toString()}>
                                  {project.nameAr || project.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="grid gap-2">
                        {category.permissions.map((permission) => (
                          <div key={permission.id} className="flex items-center space-x-3 p-2 border rounded-lg hover:bg-slate-50">
                            <Checkbox
                              checked={categoryPermissions.includes(permission.code)}
                              onCheckedChange={() => handlePermissionToggle(category.id, permission.code)}
                              disabled={category.id === 'project_roles' && !selectedProjectId}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate">{permission.name}</span>
                                <Badge variant={getRoleBadgeVariant(permission.code) as any} className="text-xs">
                                  {permission.code}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}

            {/* Impact Summary */}
            {hasChanges && (
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-800">
                    <AlertTriangle className="h-4 w-4" />
                    Impact Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-amber-700">
                    {operation === 'add' ? 'Adding' : 'Removing'} permissions for {selectedUserIds.length} users:
                  </p>
                  
                  {Object.entries(changesSummary).map(([categoryId, { category, permissions }]) => (
                    <div key={categoryId}>
                      <span className="text-sm font-medium text-amber-800">{category}:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {permissions.map((permission) => (
                          <Badge key={permission.id} variant={getRoleBadgeVariant(permission.code) as any} className="text-xs">
                            {permission.code}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  {selectedProjectId && changesSummary.project_roles && (
                    <p className="text-xs text-amber-600">
                      Project: {projects.find(p => p.id.toString() === selectedProjectId)?.name}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!hasChanges || bulkAssignMutation.isPending || (selectedPermissions.project_roles?.length > 0 && !selectedProjectId)}
          >
            {bulkAssignMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Apply Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}