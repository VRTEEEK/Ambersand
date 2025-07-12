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
  Clock,
  Loader2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import heroBackgroundPath from "@assets/image_1752308830644.png";

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
      return await apiRequest('/api/users', 'POST', data);
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
      return await apiRequest(`/api/users/${userId}/role`, 'PATCH', { role });
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
      return await apiRequest(`/api/users/${userId}`, 'DELETE');
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
      <div className="space-y-8 animate-fade-in">
        {/* Hero Section with Background */}
        <div 
          className="relative overflow-hidden rounded-2xl"
          style={{
            backgroundImage: `url(${heroBackgroundPath})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        >
          {/* Overlay for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-teal-600/90 via-teal-700/80 to-teal-800/90"></div>
          
          {/* Content */}
          <div className="relative px-8 py-16 md:py-20">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
              <div className="text-center lg:text-left">
                
                
                {/* Stats Overview */}
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 text-white/90">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                      <UsersIcon className="h-4 w-4" />
                    </div>
                    <span className="font-semibold">{users.length} {language === 'ar' ? 'مستخدم' : 'Users'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                      <Crown className="h-4 w-4" />
                    </div>
                    <span className="font-semibold">{users.filter((u: User) => u.role === 'admin').length} {language === 'ar' ? 'مدير' : 'Admins'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                      <Shield className="h-4 w-4" />
                    </div>
                    <span className="font-semibold">{users.filter((u: User) => u.role === 'manager').length} {language === 'ar' ? 'مشرف' : 'Managers'}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-center lg:justify-end">
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm px-8 py-6 text-lg rounded-xl transition-all duration-200 hover:scale-105">
                      <UserPlus className="h-5 w-5 mr-3" />
                      {language === 'ar' ? 'إضافة مستخدم جديد' : 'Add New User'}
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
            </div>
          </div>
        </div>

        {/* Search and Quick Actions */}
        <div className="grid grid-cols-1 gap-6">
          {/* Search Bar */}
          <div>
            <Card className="border border-slate-200/60 dark:border-slate-700/60 shadow-lg backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
                  <Input
                    type="search"
                    placeholder={language === 'ar' ? 'البحث عن المستخدمين بالاسم أو البريد الإلكتروني...' : 'Search users by name or email...'}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-12 h-12 text-lg border-0 bg-transparent focus:ring-2 focus:ring-[#2699A6]/20"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          
        </div>

        {/* Users List */}
        <Card className="border border-slate-200/60 dark:border-slate-700/60 shadow-xl backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-slate-50/80 to-white/80 dark:from-slate-800/80 dark:to-slate-900/80 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#2699A6]/20 rounded-xl flex items-center justify-center">
                  <UsersIcon className="h-5 w-5 text-[#2699A6]" />
                </div>
                <div>
                  <CardTitle className="text-xl text-slate-900 dark:text-white">
                    {language === 'ar' ? 'قائمة المستخدمين' : 'Users Directory'}
                  </CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400">
                    {language === 'ar' ? 'إدارة أدوار ومعلومات المستخدمين' : 'Manage user roles and information'}
                  </CardDescription>
                </div>
              </div>
              <Badge variant="secondary" className="bg-[#2699A6]/10 text-[#2699A6] border border-[#2699A6]/20 px-3 py-1">
                {filteredUsers.length} {language === 'ar' ? 'مستخدم' : 'Users'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8">
                <div className="space-y-6">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-4 p-4 bg-slate-50/50 dark:bg-slate-800/50 rounded-lg">
                      <div className="w-14 h-14 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" />
                      <div className="flex-1 space-y-3">
                        <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                  <UsersIcon className="h-10 w-10 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  {language === 'ar' ? 'لا يوجد مستخدمين' : 'No Users Found'}
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  {searchTerm 
                    ? (language === 'ar' ? 'لم يتم العثور على مستخدمين مطابقين لبحثك' : 'No users match your search criteria')
                    : (language === 'ar' ? 'ابدأ بإضافة أول مستخدم لمنظمتك' : 'Start by adding your first user to the organization')
                  }
                </p>
              </div>
            ) : (
              <div className="p-6">
                <div className="grid gap-4">
                  {filteredUsers.map((user: User, index) => (
                    <div 
                      key={user.id} 
                      className={cn(
                        "group relative p-6 bg-gradient-to-r from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-900/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60 hover:shadow-lg transition-all duration-200 hover:scale-[1.02]",
                        index % 2 === 0 ? "hover:from-[#2699A6]/5 hover:to-transparent" : "hover:from-purple-500/5 hover:to-transparent"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-5">
                          <div className="relative">
                            <Avatar className="h-16 w-16 ring-2 ring-white dark:ring-slate-800 shadow-lg">
                              <AvatarImage src={user.profileImageUrl} alt={`${user.firstName} ${user.lastName}`} />
                              <AvatarFallback className="bg-gradient-to-br from-[#2699A6] to-[#2699A6]/80 text-white font-bold text-lg">
                                {getUserInitials(user.firstName, user.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className={cn(
                              "absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center",
                              user.role === 'admin' ? 'bg-red-500' : user.role === 'manager' ? 'bg-blue-500' : 'bg-gray-500'
                            )}>
                              {getRoleIcon(user.role)}
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="text-xl font-bold text-slate-900 dark:text-white truncate">
                                {user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Unknown User'}
                              </h3>
                              <Badge className={cn("text-sm font-semibold px-3 py-1", getRoleColor(user.role))}>
                                <div className="flex items-center gap-2">
                                  {getRoleIcon(user.role)}
                                  {language === 'ar' ? (
                                    user.role === 'admin' ? 'مدير' : user.role === 'manager' ? 'مشرف' : 'مشاهد'
                                  ) : (
                                    user.role.charAt(0).toUpperCase() + user.role.slice(1)
                                  )}
                                </div>
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              <div className="flex items-center text-slate-600 dark:text-slate-400">
                                <Mail className="h-4 w-4 mr-2 text-[#2699A6]" />
                                <span className="truncate">{user.email || 'No email'}</span>
                              </div>
                              <div className="flex items-center text-slate-600 dark:text-slate-400">
                                <Calendar className="h-4 w-4 mr-2 text-[#2699A6]" />
                                <span>{language === 'ar' ? 'انضم في' : 'Joined'} {formatDate(user.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditRole(user)}
                            disabled={updateRoleMutation.isPending}
                            className="hover:bg-[#2699A6]/10 hover:border-[#2699A6]/30 hover:text-[#2699A6] transition-all duration-200"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            {language === 'ar' ? 'تعديل الدور' : 'Edit Role'}
                          </Button>
                          
                          {user.id !== currentUser?.id && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20 transition-all duration-200"
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
                      {selectedUser.firstName || selectedUser.lastName 
                        ? `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim() 
                        : 'Unknown User'}
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
                                  <Crown className="h-4 w-4 text-red-600" />
                                  {language === 'ar' ? 'مدير' : 'Admin'}
                                </div>
                              </SelectItem>
                              <SelectItem value="manager">
                                <div className="flex items-center gap-2">
                                  <Shield className="h-4 w-4 text-blue-600" />
                                  {language === 'ar' ? 'مشرف' : 'Manager'}
                                </div>
                              </SelectItem>
                              <SelectItem value="viewer">
                                <div className="flex items-center gap-2">
                                  <Eye className="h-4 w-4 text-gray-600" />
                                  {language === 'ar' ? 'مشاهد' : 'Viewer'}
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
                        {language === 'ar' ? 'إلغاء' : 'Cancel'}
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={updateRoleMutation.isPending}
                        className="bg-[#2699A6] hover:bg-[#2699A6]/90"
                      >
                        {updateRoleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {language === 'ar' ? 'حفظ' : 'Save'}
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
};