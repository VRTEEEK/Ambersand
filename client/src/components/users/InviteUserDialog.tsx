import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { 
  UserPlus, 
  Mail, 
  Loader2, 
  Building, 
  Users, 
  Info,
  Check,
  ChevronsUpDown,
  X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useI18n } from '@/hooks/use-i18n';
import type { Role, Project } from '@/shared/schema';
import { cn } from '@/lib/utils';

// Enhanced schema with multi-project validation
const inviteUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  fullName: z.string().optional(),
  personalMessage: z.string().optional(),
  orgRoles: z.array(z.string()).default([]),
  projectAssignments: z.array(z.object({
    projectId: z.number(),
    roles: z.array(z.string()).min(1, 'At least one role must be selected for each project'),
  })).default([]),
}).refine((data) => {
  // If projects are selected, each must have roles
  return data.projectAssignments.every(assignment => assignment.roles.length > 0);
}, {
  message: "Each selected project must have at least one role assigned",
  path: ["projectAssignments"],
});

type InviteUserForm = z.infer<typeof inviteUserSchema>;

interface ProjectAssignment {
  projectId: number;
  roles: string[];
}

interface InviteUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

function InviteUserDialog({ isOpen, onClose, onSuccess }: InviteUserDialogProps) {
  const { toast } = useToast();
  const { isRTL } = useI18n();

  // State for multi-project selection
  const [selectedProjects, setSelectedProjects] = useState<number[]>([]);
  const [projectAssignments, setProjectAssignments] = useState<Record<number, string[]>>({});
  const [projectSearchOpen, setProjectSearchOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');

  const form = useForm<InviteUserForm>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: {
      email: '',
      fullName: '',
      personalMessage: '',
      orgRoles: [],
      projectAssignments: [],
    },
  });

  // Fetch available roles and projects
  const { data: availableRoles = [] } = useQuery<Role[]>({
    queryKey: ['/api/roles'],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Check for duplicate invitation mutation
  const checkDuplicateMutation = useMutation({
    mutationFn: (email: string) => apiRequest(`/api/admin/users/check-duplicate?email=${encodeURIComponent(email)}`, 'GET'),
  });

  // Invite user mutation
  const inviteUserMutation = useMutation({
    mutationFn: async (data: InviteUserForm) => {
      // Check for duplicate first
      const duplicateCheck = await checkDuplicateMutation.mutateAsync(data.email);
      
      if (duplicateCheck.exists) {
        if (duplicateCheck.isPending) {
          throw new Error(`Invitation already sent to ${data.email}. Would you like to resend it?`);
        } else {
          throw new Error(`User with email ${data.email} already exists in the system.`);
        }
      }

      return apiRequest('/api/admin/users/invite', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => String(query.queryKey[0]).startsWith('/api/admin/users')
      });
      onSuccess?.();
      toast({
        title: 'Invitation Sent',
        description: 'User invitation has been sent successfully',
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Invitation Failed',
        description: error.message || 'Failed to send user invitation. Please try again.',
      });
    },
  });

  const handleClose = () => {
    form.reset();
    setSelectedProjects([]);
    setProjectAssignments({});
    setProjectSearch('');
    onClose();
  };

  const handleProjectSelect = (projectId: number) => {
    setSelectedProjects(prev => {
      const isSelected = prev.includes(projectId);
      if (isSelected) {
        // Remove project and its assignments
        const newSelected = prev.filter(id => id !== projectId);
        const newAssignments = { ...projectAssignments };
        delete newAssignments[projectId];
        setProjectAssignments(newAssignments);
        return newSelected;
      } else {
        // Add project
        return [...prev, projectId];
      }
    });
  };

  const handleProjectRoleToggle = (projectId: number, roleCode: string) => {
    setProjectAssignments(prev => {
      const currentRoles = prev[projectId] || [];
      const updatedRoles = currentRoles.includes(roleCode)
        ? currentRoles.filter(r => r !== roleCode)
        : [...currentRoles, roleCode];
      
      return { ...prev, [projectId]: updatedRoles };
    });
  };

  const handleOrgRoleToggle = (roleCode: string) => {
    const currentRoles = form.getValues('orgRoles') || [];
    const updatedRoles = currentRoles.includes(roleCode)
      ? currentRoles.filter(r => r !== roleCode)
      : [...currentRoles, roleCode];
    
    form.setValue('orgRoles', updatedRoles);
  };

  const onSubmit = (data: InviteUserForm) => {
    const projectAssignmentsData = selectedProjects.map(projectId => ({
      projectId,
      roles: projectAssignments[projectId] || [],
    })).filter(assignment => assignment.roles.length > 0);

    inviteUserMutation.mutate({
      ...data,
      projectAssignments: projectAssignmentsData,
    });
  };

  const getRoleDisplayName = (roleCode: string) => {
    const roleNames = {
      admin: 'Administrator',
      user: 'User',
      officer: 'Compliance Officer',
      collaborator: 'Collaborator',
      viewer: 'Viewer'
    };
    return roleNames[roleCode as keyof typeof roleNames] || roleCode;
  };

  const getRoleDescription = (roleCode: string): string => {
    const descriptions = {
      admin: 'Full system access, user management, and all permissions',
      user: 'Basic user access to assigned projects',
      officer: 'Compliance monitoring and oversight capabilities',
      collaborator: 'Project collaboration and task management',
      viewer: 'Read-only access to compliance data',
    };
    return descriptions[roleCode as keyof typeof descriptions] || `${roleCode} permissions`;
  };

  const getRoleBadgeVariant = (roleCode: string) => {
    const variants = {
      admin: 'destructive',
      user: 'default',
      officer: 'secondary',
      collaborator: 'outline',
      viewer: 'secondary'
    } as const;
    return variants[roleCode as keyof typeof variants] || 'outline';
  };

  // Filtered projects based on search
  const filteredProjects = (projects || []).filter(project => 
    project.name?.toLowerCase().includes(projectSearch.toLowerCase()) ||
    (project.nameAr && project.nameAr?.toLowerCase().includes(projectSearch.toLowerCase())) ||
    (project.name_ar && project.name_ar?.toLowerCase().includes(projectSearch.toLowerCase()))
  );

  // Debug logging
  console.log('InviteDialog - Projects:', projects);
  console.log('InviteDialog - FilteredProjects:', filteredProjects);

  // Disable body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col z-[1000]" aria-describedby="invite-user-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite New User
          </DialogTitle>
          <DialogDescription id="invite-user-description">
            Send an invitation to join your organization with specific roles and permissions
          </DialogDescription>
        </DialogHeader>

        <TooltipProvider>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col">
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="user@example.com" 
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
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name (Optional)</FormLabel>
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
                    name="personalMessage"
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

                  {/* Project Selection */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        <CardTitle className="text-lg">Assign to Projects (Optional)</CardTitle>
                      </div>
                      <CardDescription>
                        Select one or more projects and assign roles for each
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Multi-select Project Dropdown */}
                        <Popover open={projectSearchOpen} onOpenChange={setProjectSearchOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={projectSearchOpen}
                              className="w-full justify-between"
                            >
                              {selectedProjects.length === 0
                                ? "Select projects..."
                                : `${selectedProjects.length} project${selectedProjects.length > 1 ? 's' : ''} selected`}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0">
                            <Command>
                              <CommandInput 
                                placeholder="Search projects..." 
                                value={projectSearch}
                                onValueChange={setProjectSearch}
                              />
                              <CommandList>
                                <CommandEmpty>No projects found.</CommandEmpty>
                                <CommandGroup>
                                  {filteredProjects.map((project) => (
                                    <CommandItem
                                      key={project.id}
                                      onSelect={() => handleProjectSelect(project.id)}
                                      className="flex items-center gap-2"
                                    >
                                      <Checkbox
                                        checked={selectedProjects.includes(project.id)}
                                        onChange={() => handleProjectSelect(project.id)}
                                      />
                                      <span className="flex-1">
                                        {isRTL ? project.nameAr || project.name : project.name}
                                      </span>
                                      {selectedProjects.includes(project.id) && (
                                        <Check className="h-4 w-4" />
                                      )}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>

                        {/* Selected Projects Chips */}
                        {selectedProjects.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {selectedProjects.map((projectId) => {
                              const project = projects.find(p => p.id === projectId);
                              if (!project) return null;
                              
                              return (
                                <Badge 
                                  key={projectId} 
                                  variant="secondary" 
                                  className="flex items-center gap-1"
                                >
                                  {isRTL ? project.nameAr || project.name : project.name}
                                  <button
                                    type="button"
                                    onClick={() => handleProjectSelect(projectId)}
                                    className="ml-1 hover:bg-secondary-foreground/20 rounded-sm"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              );
                            })}
                          </div>
                        )}

                        {/* Quick Actions */}
                        {projects.length > 0 && (
                          <div className="flex gap-2 text-sm">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedProjects([]);
                                setProjectAssignments({});
                              }}
                            >
                              Select None
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedProjects(projects.map(p => p.id))}
                            >
                              Select All
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Organization Roles */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <CardTitle className="text-lg">Organization Roles</CardTitle>
                      </div>
                      <CardDescription>
                        System-wide roles that apply across the entire organization
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3">
                        {availableRoles.map((role) => (
                          <div 
                            key={role.id} 
                            className={cn(
                              "flex items-start space-x-3 rtl:space-x-reverse p-4 border rounded-lg transition-all",
                              (form.watch('orgRoles') || []).includes(role.code) 
                                ? 'bg-primary/5 border-primary/30 shadow-sm' 
                                : 'hover:bg-muted/30'
                            )}
                          >
                            <Checkbox
                              checked={(form.watch('orgRoles') || []).includes(role.code)}
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
                  </Card>

                  {/* Project Roles - Only shown when projects are selected */}
                  {selectedProjects.length > 0 && (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4" />
                          <CardTitle className="text-lg">Project Roles</CardTitle>
                        </div>
                        <CardDescription>
                          Assign roles for each selected project
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {selectedProjects.map((projectId) => {
                          const project = projects.find(p => p.id === projectId);
                          if (!project) return null;
                          
                          return (
                            <div key={projectId} className="border rounded-lg p-4">
                              <h4 className="font-medium mb-4 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-primary"></div>
                                {isRTL ? project.nameAr || project.name : project.name}
                              </h4>
                              <div className="grid gap-3">
                                {availableRoles.map((role) => (
                                  <div 
                                    key={`${projectId}-${role.id}`} 
                                    className={cn(
                                      "flex items-start space-x-3 rtl:space-x-reverse p-3 rounded-md transition-all",
                                      (projectAssignments[projectId] || []).includes(role.code)
                                        ? 'bg-primary/5 border border-primary/20' 
                                        : 'hover:bg-muted/30'
                                    )}
                                  >
                                    <Checkbox
                                      checked={(projectAssignments[projectId] || []).includes(role.code)}
                                      onCheckedChange={() => handleProjectRoleToggle(projectId, role.code)}
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
                              {/* Inline error for project without roles */}
                              {selectedProjects.includes(projectId) && (!projectAssignments[projectId] || projectAssignments[projectId].length === 0) && (
                                <p className="text-sm text-destructive mt-2">
                                  Please select at least one role for this project
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>

              <DialogFooter className="mt-6 flex-shrink-0">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={inviteUserMutation.isPending || checkDuplicateMutation.isPending}
                  className="flex items-center gap-2 min-w-[140px]"
                >
                  {(inviteUserMutation.isPending || checkDuplicateMutation.isPending) ? (
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

export default InviteUserDialog;