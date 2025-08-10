import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, UserPlus, Loader2, Mail } from 'lucide-react';

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

const inviteUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  org_roles: z.array(z.string()).optional(),
  project_roles: z.array(z.object({
    project_id: z.number(),
    roles: z.array(z.string()),
  })).optional(),
});

type InviteUserForm = z.infer<typeof inviteUserSchema>;

interface InviteUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function InviteUserDialog({ isOpen, onClose, onSuccess }: InviteUserDialogProps) {
  const { t, isRTL } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedOrgRoles, setSelectedOrgRoles] = useState<string[]>([]);
  const [projectRoleAssignments, setProjectRoleAssignments] = useState<Record<number, string[]>>({});

  const form = useForm<InviteUserForm>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: {
      email: '',
      name: '',
      org_roles: [],
      project_roles: [],
    },
  });

  // Fetch available roles and projects
  const { data: availableRoles = [] } = useQuery<Role[]>({
    queryKey: ['/api/roles'],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Invite user mutation
  const inviteUserMutation = useMutation({
    mutationFn: (data: InviteUserForm) => apiRequest('/api/admin/users/invite', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => String(query.queryKey[0]).startsWith('/api/admin/users')
      });
      onSuccess?.();
      toast({
        title: t('users.inviteSuccess'),
        description: t('users.inviteSuccessDescription'),
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: t('users.inviteError'),
        description: error.message || t('users.inviteErrorDescription'),
      });
    },
  });

  const handleClose = () => {
    form.reset();
    setSelectedOrgRoles([]);
    setProjectRoleAssignments({});
    onClose();
  };

  const handleOrgRoleToggle = (roleCode: string) => {
    setSelectedOrgRoles(prev => 
      prev.includes(roleCode) 
        ? prev.filter(r => r !== roleCode)
        : [...prev, roleCode]
    );
  };

  const handleProjectRoleToggle = (projectId: number, roleCode: string) => {
    setProjectRoleAssignments(prev => {
      const currentRoles = prev[projectId] || [];
      const updatedRoles = currentRoles.includes(roleCode)
        ? currentRoles.filter(r => r !== roleCode)
        : [...currentRoles, roleCode];
      
      if (updatedRoles.length === 0) {
        const { [projectId]: removed, ...rest } = prev;
        return rest;
      }
      
      return { ...prev, [projectId]: updatedRoles };
    });
  };

  const onSubmit = (data: InviteUserForm) => {
    const projectRoles = Object.entries(projectRoleAssignments)
      .filter(([_, roles]) => roles.length > 0)
      .map(([projectId, roles]) => ({
        project_id: parseInt(projectId),
        roles,
      }));

    inviteUserMutation.mutate({
      ...data,
      org_roles: selectedOrgRoles,
      project_roles: projectRoles,
    });
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

  return (
    <Dialog open={isOpen} onOpenChange={() => handleClose()}>
      <DialogContent className="max-w-3xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {t('users.inviteUser')}
          </DialogTitle>
          <DialogDescription>
            {t('users.inviteUserDescription')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col">
            <ScrollArea className="flex-1 pr-6">
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('users.email')}</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={t('users.emailPlaceholder')} 
                            type="email"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('users.name')}</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={t('users.namePlaceholder')} 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Organization Roles */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{t('users.organizationRoles')}</CardTitle>
                    <CardDescription>
                      {t('users.selectOrgRolesDescription')}
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
                      {t('users.selectProjectRolesDescription')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {projects.map((project) => (
                      <div key={project.id} className="border rounded-lg p-4">
                        <h4 className="font-medium mb-3">
                          {isRTL ? project.nameAr || project.name : project.name}
                        </h4>
                        <div className="grid gap-2">
                          {availableRoles.map((role) => (
                            <div key={`${project.id}-${role.id}`} className="flex items-center space-x-3">
                              <Checkbox
                                checked={(projectRoleAssignments[project.id] || []).includes(role.code)}
                                onCheckedChange={() => handleProjectRoleToggle(project.id, role.code)}
                              />
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{getRoleDisplayName(role.code)}</span>
                                <Badge variant={getRoleBadgeVariant(role.code)} className="text-xs">
                                  {role.code}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={handleClose}>
                {t('common.cancel')}
              </Button>
              <Button 
                type="submit" 
                disabled={inviteUserMutation.isPending}
                className="flex items-center gap-2"
              >
                {inviteUserMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                {t('users.sendInvite')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}