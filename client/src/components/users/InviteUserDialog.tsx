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
import { X, UserPlus, Loader2, Mail, ChevronDown, ChevronRight, Info, Building, Users } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';

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
  message: z.string().optional(),
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
  const [orgRolesOpen, setOrgRolesOpen] = useState(true);
  const [projectRolesOpen, setProjectRolesOpen] = useState(false);

  const form = useForm<InviteUserForm>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: {
      email: '',
      name: '',
      message: '',
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
    setOrgRolesOpen(true);
    setProjectRolesOpen(false);
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
      <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite New User
          </DialogTitle>
          <DialogDescription>
            Send an invitation to join your organization with specific roles and permissions
          </DialogDescription>
        </DialogHeader>

        <TooltipProvider>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col">
              <ScrollArea className="flex-1 pr-6">
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Enter email address" 
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
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Enter full name" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Personal Message */}
                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Personal Message (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Add a personal message to include with the invitation..."
                            className="min-h-[80px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Organization Roles */}
                  <Collapsible open={orgRolesOpen} onOpenChange={setOrgRolesOpen}>
                    <Card>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Building className="h-4 w-4" />
                              <CardTitle className="text-lg">Organization Roles</CardTitle>
                            </div>
                            {orgRolesOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </div>
                          <CardDescription>
                            System-wide roles that apply across the entire organization
                          </CardDescription>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0">
                          <div className="grid gap-3">
                            {availableRoles.map((role) => (
                              <div 
                                key={role.id} 
                                className={`flex items-start space-x-3 rtl:space-x-reverse p-4 border rounded-lg transition-all ${
                                  selectedOrgRoles.includes(role.code) 
                                    ? 'bg-primary/5 border-primary/30 shadow-sm' 
                                    : 'hover:bg-muted/30'
                                }`}
                              >
                                <Checkbox
                                  checked={selectedOrgRoles.includes(role.code)}
                                  onCheckedChange={() => handleOrgRoleToggle(role.code)}
                                  className="mt-1"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium">{getRoleDisplayName(role.code)}</span>
                                    <Badge variant={getRoleBadgeVariant(role.code) as any}>
                                      {role.code}
                                    </Badge>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Info className="h-3 w-3 text-muted-foreground hover:text-foreground cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs">
                                        <p>{getRoleDescription(role.code)}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {getRoleDescription(role.code)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>

                  {/* Project Roles */}
                  <Collapsible open={projectRolesOpen} onOpenChange={setProjectRolesOpen}>
                    <Card>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              <CardTitle className="text-lg">Project Roles</CardTitle>
                            </div>
                            {projectRolesOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </div>
                          <CardDescription>
                            Roles specific to individual projects
                          </CardDescription>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0 space-y-4">
                          {projects.map((project) => (
                            <div key={project.id} className="border rounded-lg p-4">
                              <h4 className="font-medium mb-4 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-primary"></div>
                                {isRTL ? project.nameAr || project.name : project.name}
                              </h4>
                              <div className="grid gap-3">
                                {availableRoles.map((role) => (
                                  <div 
                                    key={`${project.id}-${role.id}`} 
                                    className={`flex items-start space-x-3 rtl:space-x-reverse p-3 rounded-md transition-all ${
                                      (projectRoleAssignments[project.id] || []).includes(role.code)
                                        ? 'bg-primary/5 border border-primary/20' 
                                        : 'hover:bg-muted/30'
                                    }`}
                                  >
                                    <Checkbox
                                      checked={(projectRoleAssignments[project.id] || []).includes(role.code)}
                                      onCheckedChange={() => handleProjectRoleToggle(project.id, role.code)}
                                      className="mt-0.5"
                                    />
                                    <div className="flex items-center gap-2 flex-1">
                                      <span className="text-sm font-medium">{getRoleDisplayName(role.code)}</span>
                                      <Badge variant={getRoleBadgeVariant(role.code) as any} className="text-xs">
                                        {role.code}
                                      </Badge>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Info className="h-3 w-3 text-muted-foreground hover:text-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-xs">
                                          <p>{getRoleDescription(role.code)}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                </div>
              </ScrollArea>

              <DialogFooter className="mt-6 flex-shrink-0">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={inviteUserMutation.isPending}
                  className="flex items-center gap-2 min-w-[140px]"
                >
                  {inviteUserMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  Send Invite
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}