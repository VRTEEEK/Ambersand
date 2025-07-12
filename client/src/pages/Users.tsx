import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/hooks/use-i18n';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isUnauthorizedError } from '@/lib/authUtils';
import { apiRequest } from '@/lib/queryClient';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
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
  Clock
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
  profileImageUrl?: string;
  role: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

const createUserSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
  email: z.string().email('Valid email is required'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(['admin', 'manager', 'viewer']),
});

const updateRoleSchema = z.object({
  role: z.enum(['admin', 'manager', 'viewer']),
});

type CreateUserData = z.infer<typeof createUserSchema>;
type UpdateRoleData = z.infer<typeof updateRoleSchema>;

export default function Users() {
  const { user: currentUser, isAuthenticated, isLoading: authLoading } = useAuth();
  const { t, language } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);

  // Forms
  const createForm = useForm<CreateUserData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      role: 'viewer',
    },
  });

  const roleForm = useForm<UpdateRoleData>({
    resolver: zodResolver(updateRoleSchema),
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  // Fetch users
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['/api/users'],
    enabled: isAuthenticated && currentUser?.role === 'admin',
    retry: false,
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserData) => {
      return await apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: t('common.success'),
        description: language === 'ar' ? 'تم إنشاء المستخدم بنجاح' : 'User created successfully',
      });
      createForm.reset();
      setIsCreateDialogOpen(false);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: t('common.error'),
        description: language === 'ar' ? 'فشل في إنشاء المستخدم' : 'Failed to create user',
        variant: "destructive",
      });
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return await apiRequest(`/api/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: t('common.success'),
        description: language === 'ar' ? 'تم تحديث الدور بنجاح' : 'Role updated successfully',
      });
      setIsRoleDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: t('common.error'),
        description: language === 'ar' ? 'فشل في تحديث الدور' : 'Failed to update role',
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest(`/api/users/${userId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: t('common.success'),
        description: language === 'ar' ? 'تم حذف المستخدم بنجاح' : 'User deleted successfully',
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: t('common.error'),
        description: language === 'ar' ? 'فشل في حذف المستخدم' : 'Failed to delete user',
        variant: "destructive",
      });
    },
  });

  const filteredUsers = users.filter((user: User) => 
    user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'manager':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'viewer':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="h-3 w-3" />;
      case 'manager':
        return <Shield className="h-3 w-3" />;
      case 'viewer':
        return <Eye className="h-3 w-3" />;
      default:
        return <Eye className="h-3 w-3" />;
    }
  };

  const getUserInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return 'U';
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US');
  };

  const onCreateSubmit = (data: CreateUserData) => {
    createUserMutation.mutate(data);
  };

  const onRoleSubmit = (data: UpdateRoleData) => {
    if (selectedUser) {
      updateRoleMutation.mutate({ userId: selectedUser.id, role: data.role });
    }
  };

  const handleEditRole = (user: User) => {
    setSelectedUser(user);
    roleForm.setValue('role', user.role as any);
    setIsRoleDialogOpen(true);
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا المستخدم؟' : 'Are you sure you want to delete this user?')) {
      deleteUserMutation.mutate(userId);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2699A6] mx-auto"></div>
          <p className="mt-4 text-slate-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  // Check if user is admin
  if (currentUser?.role !== 'admin') {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Shield className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {language === 'ar' ? 'الوصول مرفوض' : 'Access Denied'}
            </h2>
            <p className="text-gray-600">
              {language === 'ar' ? 'تحتاج إلى صلاحيات المدير للوصول إلى إدارة المستخدمين' : 'You need admin privileges to access user management'}
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#2699A6] to-[#2699A6]/80 rounded-xl flex items-center justify-center">
                <UsersIcon className="h-6 w-6 text-white" />
              </div>
              {language === 'ar' ? 'إدارة المستخدمين' : 'User Management'}
            </h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              {language === 'ar' ? 'إدارة المستخدمين والأدوار في المنظمة' : 'Manage users and roles in your organization'}
            </p>
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#2699A6] hover:bg-[#2699A6]/90 text-white">
                <UserPlus className="h-4 w-4 mr-2" />
                {language === 'ar' ? 'إضافة مستخدم' : 'Add User'}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {language === 'ar' ? 'إضافة مستخدم جديد' : 'Add New User'}
                </DialogTitle>
                <DialogDescription>
                  {language === 'ar' ? 'أدخل معلومات المستخدم الجديد' : 'Enter the new user details'}
                </DialogDescription>
              </DialogHeader>

              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                  <FormField
                    control={createForm.control}
                    name="id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === 'ar' ? 'معرف المستخدم' : 'User ID'}</FormLabel>
                        <FormControl>
                          <Input placeholder={language === 'ar' ? 'أدخل معرف المستخدم' : 'Enter user ID'} {...field} />
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
                        <FormLabel>{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder={language === 'ar' ? 'أدخل البريد الإلكتروني' : 'Enter email address'} {...field} />
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
                          <FormLabel>{language === 'ar' ? 'الاسم الأول' : 'First Name'}</FormLabel>
                          <FormControl>
                            <Input placeholder={language === 'ar' ? 'الاسم الأول' : 'First name'} {...field} />
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
                          <FormLabel>{language === 'ar' ? 'اسم العائلة' : 'Last Name'}</FormLabel>
                          <FormControl>
                            <Input placeholder={language === 'ar' ? 'اسم العائلة' : 'Last name'} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={createForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === 'ar' ? 'الدور' : 'Role'}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={language === 'ar' ? 'اختر الدور' : 'Select role'} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="admin">
                              <div className="flex items-center gap-2">
                                <Crown className="h-4 w-4" />
                                {language === 'ar' ? 'مدير' : 'Admin'}
                              </div>
                            </SelectItem>
                            <SelectItem value="manager">
                              <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                {language === 'ar' ? 'مشرف' : 'Manager'}
                              </div>
                            </SelectItem>
                            <SelectItem value="viewer">
                              <div className="flex items-center gap-2">
                                <Eye className="h-4 w-4" />
                                {language === 'ar' ? 'مشاهد' : 'Viewer'}
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      {language === 'ar' ? 'إلغاء' : 'Cancel'}
                    </Button>
                    <Button type="submit" disabled={createUserMutation.isPending}>
                      {createUserMutation.isPending 
                        ? (language === 'ar' ? 'جاري الإنشاء...' : 'Creating...') 
                        : (language === 'ar' ? 'إنشاء المستخدم' : 'Create User')
                      }
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border border-slate-200 dark:border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    {language === 'ar' ? 'إجمالي المستخدمين' : 'Total Users'}
                  </p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {users.length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-[#2699A6]/10 rounded-xl flex items-center justify-center">
                  <UsersIcon className="h-6 w-6 text-[#2699A6]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 dark:border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    {language === 'ar' ? 'المدراء' : 'Admins'}
                  </p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {users.filter((u: User) => u.role === 'admin').length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-xl flex items-center justify-center">
                  <Crown className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 dark:border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    {language === 'ar' ? 'المشرفين' : 'Managers'}
                  </p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {users.filter((u: User) => u.role === 'manager').length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
                  <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="border border-slate-200 dark:border-slate-700">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                type="search"
                placeholder={language === 'ar' ? 'البحث عن المستخدمين...' : 'Search users...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Users List */}
        <Card className="border border-slate-200 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="h-5 w-5" />
              {language === 'ar' ? 'قائمة المستخدمين' : 'Users List'}
            </CardTitle>
            <CardDescription>
              {language === 'ar' ? 'إدارة أدوار ومعلومات المستخدمين' : 'Manage user roles and information'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6">
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-6 text-center">
                <UsersIcon className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600 dark:text-slate-400">
                  {language === 'ar' ? 'لم يتم العثور على مستخدمين' : 'No users found'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredUsers.map((user: User) => (
                  <div key={user.id} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={user.profileImageUrl} alt={`${user.firstName} ${user.lastName}`} />
                          <AvatarFallback className="bg-[#2699A6]/10 text-[#2699A6] font-semibold">
                            {getUserInitials(user.firstName, user.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3 mb-1">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
                              {user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Unknown User'}
                            </h3>
                            <Badge className={cn("text-xs", getRoleColor(user.role))}>
                              <div className="flex items-center gap-1">
                                {getRoleIcon(user.role)}
                                {language === 'ar' ? (
                                  user.role === 'admin' ? 'مدير' : user.role === 'manager' ? 'مشرف' : 'مشاهد'
                                ) : (
                                  user.role.charAt(0).toUpperCase() + user.role.slice(1)
                                )}
                              </div>
                            </Badge>
                          </div>
                          
                          <div className="flex items-center space-x-4 text-sm text-slate-600 dark:text-slate-400">
                            <div className="flex items-center">
                              <Mail className="h-4 w-4 mr-1" />
                              {user.email || 'No email'}
                            </div>
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              {formatDate(user.createdAt)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditRole(user)}
                          disabled={updateRoleMutation.isPending}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          {language === 'ar' ? 'تعديل الدور' : 'Edit Role'}
                        </Button>
                        
                        {user.id !== currentUser?.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={deleteUserMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Role Edit Dialog */}
        <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>
                {language === 'ar' ? 'تعديل دور المستخدم' : 'Edit User Role'}
              </DialogTitle>
              <DialogDescription>
                {language === 'ar' ? 'اختر الدور الجديد للمستخدم' : 'Select the new role for the user'}
              </DialogDescription>
            </DialogHeader>

            {selectedUser && (
              <div className="space-y-4">
                <div className="flex items-center space-x-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={selectedUser.profileImageUrl} />
                    <AvatarFallback className="bg-[#2699A6]/10 text-[#2699A6] text-sm">
                      {getUserInitials(selectedUser.firstName, selectedUser.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {selectedUser.firstName || selectedUser.lastName ? `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim() : 'Unknown User'}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{selectedUser.email}</p>
                  </div>
                </div>

                <Form {...roleForm}>
                  <form onSubmit={roleForm.handleSubmit(onRoleSubmit)} className="space-y-4">
                    <FormField
                      control={roleForm.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'ar' ? 'الدور الجديد' : 'New Role'}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={language === 'ar' ? 'اختر الدور' : 'Select role'} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="admin">
                                <div className="flex items-center gap-2">
                                  <Crown className="h-4 w-4" />
                                  {language === 'ar' ? 'مدير' : 'Admin'}
                                </div>
                              </SelectItem>
                              <SelectItem value="manager">
                                <div className="flex items-center gap-2">
                                  <Shield className="h-4 w-4" />
                                  {language === 'ar' ? 'مشرف' : 'Manager'}
                                </div>
                              </SelectItem>
                              <SelectItem value="viewer">
                                <div className="flex items-center gap-2">
                                  <Eye className="h-4 w-4" />
                                  {language === 'ar' ? 'مشاهد' : 'Viewer'}
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
                        {language === 'ar' ? 'إلغاء' : 'Cancel'}
                      </Button>
                      <Button type="submit" disabled={updateRoleMutation.isPending}>
                        {updateRoleMutation.isPending 
                          ? (language === 'ar' ? 'جاري التحديث...' : 'Updating...') 
                          : (language === 'ar' ? 'تحديث الدور' : 'Update Role')
                        }
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}