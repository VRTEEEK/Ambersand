import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/hooks/use-i18n';
import { useToast } from '@/hooks/use-toast';
import { usePermissions, PERMISSIONS } from '@/hooks/use-permissions';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Users as UsersIcon, 
  Search, 
  UserPlus, 
  Mail, 
  Calendar, 
  Shield, 
  Settings,
  MoreHorizontal,
  Edit,
  Trash2,
  Crown,
  Eye,
  Clock,
  Loader2,
  User2,
  KeyRound
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  profileImageUrl?: string;
  role: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
  userRoles?: Role[];
}

interface Role {
  id: string;
  code: string;
  name: string;
}

interface Permission {
  id: string;
  code: string;
  description: string;
}

const createUserSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
  email: z.string().email('Valid email is required'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

const updateNameSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
});

const roleAssignmentSchema = z.object({
  roleIds: z.array(z.string()).min(1, 'At least one role must be selected'),
});

export default function Users() {
  const { user: currentUser } = useAuth();
  const { t, isRTL } = useI18n();
  const { toast } = useToast();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);

  // Check permissions
  const canManageUsers = can(PERMISSIONS.CHANGE_USER_PERMISSIONS);

  if (!canManageUsers) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <Shield className="h-16 w-16 text-slate-400 mb-4" />
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">
            {t('users.noAccess')}
          </h2>
          <p className="text-slate-600 max-w-md">
            {t('users.noAccessDescription')}
          </p>
        </div>
      </AppLayout>
    );
  }

  // Fetch users
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Fetch roles
  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ['/api/roles'],
  });

  // Fetch permissions for reference
  const { data: permissions = [] } = useQuery<Permission[]>({
    queryKey: ['/api/permissions'],
  });

  // Create user form
  const createForm = useForm<z.infer<typeof createUserSchema>>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      id: '',
      email: '',
      firstName: '',
      lastName: '',
    },
  });

  // Edit user form
  const editForm = useForm<z.infer<typeof updateNameSchema>>({
    resolver: zodResolver(updateNameSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
    },
  });

  // Role assignment form
  const roleForm = useForm<z.infer<typeof roleAssignmentSchema>>({
    resolver: zodResolver(roleAssignmentSchema),
    defaultValues: {
      roleIds: [],
    },
  });

  // Mutations
  const createUserMutation = useMutation({
    mutationFn: (data: z.infer<typeof createUserSchema>) => 
      apiRequest('/api/users', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({ 
        title: t('users.created'), 
        description: t('users.createdDescription') 
      });
      setIsCreateDialogOpen(false);
      createForm.reset();
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: t('users.createError'),
        description: error.message || t('users.createErrorDescription'),
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, ...data }: { userId: string } & z.infer<typeof updateNameSchema>) => 
      apiRequest(`/api/users/${userId}`, 'PATCH', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({ 
        title: t('users.updated'), 
        description: t('users.updatedDescription') 
      });
      setIsEditDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: t('users.updateError'),
        description: error.message || t('users.updateErrorDescription'),
      });
    },
  });

  const updateUserRolesMutation = useMutation({
    mutationFn: ({ userId, roleIds }: { userId: string; roleIds: string[] }) => 
      apiRequest(`/api/users/${userId}/roles`, 'PUT', { roleIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/me/permissions'] });
      toast({ 
        title: t('users.rolesUpdated'), 
        description: t('users.rolesUpdatedDescription') 
      });
      setIsRoleDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: t('users.roleUpdateError'),
        description: error.message || t('users.roleUpdateErrorDescription'),
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => apiRequest(`/api/users/${userId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({ 
        title: t('users.deleted'), 
        description: t('users.deletedDescription') 
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: t('users.deleteError'),
        description: error.message || t('users.deleteErrorDescription'),
      });
    },
  });

  // Filter users based on search
  const filteredUsers = users.filter(user => {
    const searchTerm = searchQuery.toLowerCase();
    return (
      user.email?.toLowerCase().includes(searchTerm) ||
      user.firstName?.toLowerCase().includes(searchTerm) ||
      user.lastName?.toLowerCase().includes(searchTerm) ||
      user.name?.toLowerCase().includes(searchTerm)
    );
  });

  const handleCreateUser = (data: z.infer<typeof createUserSchema>) => {
    createUserMutation.mutate(data);
  };

  const handleEditUser = (data: z.infer<typeof updateNameSchema>) => {
    if (!selectedUser) return;
    updateUserMutation.mutate({ userId: selectedUser.id, ...data });
  };

  const handleUpdateRoles = (data: z.infer<typeof roleAssignmentSchema>) => {
    if (!selectedUser) return;
    updateUserRolesMutation.mutate({ userId: selectedUser.id, roleIds: data.roleIds });
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm(t('users.deleteConfirmation'))) {
      deleteUserMutation.mutate(userId);
    }
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    editForm.reset({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
    });
    setIsEditDialogOpen(true);
  };

  const openRoleDialog = (user: User) => {
    setSelectedUser(user);
    roleForm.reset({
      roleIds: user.userRoles?.map(r => r.id) || [],
    });
    setIsRoleDialogOpen(true);
  };

  const getRoleDisplayName = (roleCode: string) => {
    const roleNames = {
      'admin': 'Administrator',
      'user': 'User',
      'officer': 'Compliance Officer', 
      'collaborator': 'Collaborator',
      'viewer': 'Viewer'
    };
    return roleNames[roleCode as keyof typeof roleNames] || roleCode;
  };

  const getRoleBadgeColor = (roleCode: string) => {
    const colors = {
      'admin': 'bg-red-100 text-red-800',
      'user': 'bg-blue-100 text-blue-800',
      'officer': 'bg-purple-100 text-purple-800',
      'collaborator': 'bg-green-100 text-green-800',
      'viewer': 'bg-slate-100 text-slate-800'
    };
    return colors[roleCode as keyof typeof colors] || 'bg-slate-100 text-slate-800';
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {t('users.title')}
            </h1>
            <p className="text-slate-600">
              {t('users.description')}
            </p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            {t('users.addUser')}
          </Button>
        </div>

        {/* Search and Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="md:col-span-3">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t('users.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-slate-900">{users.length}</div>
              <div className="text-sm text-slate-600">{t('users.totalUsers')}</div>
            </CardContent>
          </Card>
        </div>

        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="h-5 w-5" />
              {t('users.userDirectory')}
            </CardTitle>
            <CardDescription>
              {t('users.manageRoles')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <User2 className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600">{t('users.noUsersFound')}</p>
                <p className="text-slate-500 text-sm mt-1">
                  {searchQuery ? t('users.tryDifferentSearch') : t('users.startByAdding')}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50">
                    <div className="flex items-center space-x-4">
                      <UserAvatar user={user} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-slate-900">
                            {user.firstName && user.lastName 
                              ? `${user.firstName} ${user.lastName}`
                              : user.name || user.email
                            }
                          </h3>
                          {user.id === currentUser?.id && (
                            <Badge variant="outline" className="text-xs">
                              {t('users.you')}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-600">{user.email}</p>
                        <div className="flex items-center gap-2 mt-2">
                          {user.userRoles?.map((role) => (
                            <Badge 
                              key={role.id} 
                              className={cn("text-xs", getRoleBadgeColor(role.code))}
                            >
                              {getRoleDisplayName(role.code)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(user)}>
                            <Edit className="h-4 w-4 mr-2" />
                            {t('users.editProfile')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openRoleDialog(user)}>
                            <KeyRound className="h-4 w-4 mr-2" />
                            {t('users.manageRoles')}
                          </DropdownMenuItem>
                          {user.id !== currentUser?.id && (
                            <DropdownMenuItem 
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t('users.deleteUser')}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create User Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('users.addUser')}</DialogTitle>
              <DialogDescription>
                {t('users.addUserDescription')}
              </DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(handleCreateUser)} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('users.userId')}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="user123" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('users.email')}</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="user@example.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('users.firstName')}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('users.lastName')}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createUserMutation.isPending}
                  >
                    {createUserMutation.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {t('users.createUser')}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('users.editProfile')}</DialogTitle>
              <DialogDescription>
                {t('users.editProfileDescription')}
              </DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleEditUser)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('users.firstName')}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('users.lastName')}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsEditDialogOpen(false)}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateUserMutation.isPending}
                  >
                    {updateUserMutation.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {t('common.save')}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Role Management Dialog */}
        <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('users.manageRoles')}</DialogTitle>
              <DialogDescription>
                {t('users.manageRolesDescription')}
              </DialogDescription>
            </DialogHeader>
            <Form {...roleForm}>
              <form onSubmit={roleForm.handleSubmit(handleUpdateRoles)} className="space-y-4">
                <FormField
                  control={roleForm.control}
                  name="roleIds"
                  render={() => (
                    <FormItem>
                      <FormLabel>{t('users.assignedRoles')}</FormLabel>
                      <ScrollArea className="h-48 border rounded-md p-4">
                        <div className="space-y-3">
                          {roles.map((role) => (
                            <FormField
                              key={role.id}
                              control={roleForm.control}
                              name="roleIds"
                              render={({ field }) => {
                                return (
                                  <FormItem
                                    key={role.id}
                                    className="flex flex-row items-start space-x-3 space-y-0"
                                  >
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(role.id)}
                                        onCheckedChange={(checked) => {
                                          return checked
                                            ? field.onChange([...field.value, role.id])
                                            : field.onChange(
                                                field.value?.filter(
                                                  (value) => value !== role.id
                                                )
                                              )
                                        }}
                                      />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                      <FormLabel className="font-medium">
                                        {getRoleDisplayName(role.code)}
                                      </FormLabel>
                                      <p className="text-xs text-slate-600">
                                        {role.code}
                                      </p>
                                    </div>
                                  </FormItem>
                                )
                              }}
                            />
                          ))}
                        </div>
                      </ScrollArea>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsRoleDialogOpen(false)}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateUserRolesMutation.isPending}
                  >
                    {updateUserRolesMutation.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {t('users.updateRoles')}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}