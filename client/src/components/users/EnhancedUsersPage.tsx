import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/hooks/use-i18n';
import { useToast } from '@/hooks/use-toast';
import { usePermissions, PERMISSIONS } from '@/hooks/use-permissions';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useDebounce } from '@/hooks/use-debounce';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import UserRolesDrawer from './UserRolesDrawer';
import BulkAssignDialog from './BulkAssignDialog';
import { 
  Users as UsersIcon, 
  Search, 
  UserPlus, 
  Shield, 
  MoreHorizontal,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  Eye,
  Settings,
  Filter,
  ChevronDown,
  CheckSquare,
  Square,
  Loader2
} from 'lucide-react';
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
  status?: 'active' | 'disabled';
  lastActiveAt?: string;
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

export default function EnhancedUsersPage() {
  const { user: currentUser } = useAuth();
  const { t, isRTL } = useI18n();
  const { toast } = useToast();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'lastActive'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  
  // Dialogs/Drawers
  const [isRolesDrawerOpen, setIsRolesDrawerOpen] = useState(false);
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Debounce search
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Check permissions
  const canManageUsers = can(PERMISSIONS.CHANGE_USER_PERMISSIONS);

  // Query params for API call
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('query', debouncedSearch);
    if (selectedRole && selectedRole !== 'all') params.set('role', selectedRole);
    if (selectedStatus && selectedStatus !== 'all') params.set('status', selectedStatus);
    if (selectedProject && selectedProject !== 'all') params.set('project_id', selectedProject);
    params.set('page', page.toString());
    params.set('page_size', pageSize.toString());
    params.set('sort_by', sortBy);
    params.set('sort_order', sortOrder);
    return params.toString();
  }, [debouncedSearch, selectedRole, selectedStatus, selectedProject, page, pageSize, sortBy, sortOrder]);

  // Fetch data
  const { data: usersResponse, isLoading: usersLoading } = useQuery({
    queryKey: ['/api/admin/users', queryParams],
    queryFn: () => fetch(`/api/admin/users?${queryParams}`).then(res => res.json()),
    enabled: canManageUsers,
  });

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ['/api/roles'],
    enabled: canManageUsers,
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    enabled: canManageUsers,
  });

  // Mutations
  const updateUserStatusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: 'active' | 'disabled' }) =>
      apiRequest(`/api/users/${userId}/status`, 'POST', { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: t('users.statusUpdated') });
    },
  });

  // Event handlers
  const handleUserSelect = (userId: string, checked: boolean) => {
    setSelectedUsers(prev => 
      checked 
        ? [...prev, userId]
        : prev.filter(id => id !== userId)
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(usersResponse?.users?.map((u: User) => u.id) || []);
    } else {
      setSelectedUsers([]);
    }
  };

  const openRolesDrawer = (user: User) => {
    setSelectedUser(user);
    setIsRolesDrawerOpen(true);
  };

  const openBulkAssign = () => {
    setIsBulkAssignOpen(true);
  };

  const handleStatusToggle = (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    updateUserStatusMutation.mutate({ userId, status: newStatus });
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

  const getStatusBadgeVariant = (status: string) => {
    return status === 'active' ? 'default' : 'secondary';
  };

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

  const users = usersResponse?.users || [];
  const totalUsers = usersResponse?.total || 0;
  const totalPages = Math.ceil(totalUsers / pageSize);
  const isAllSelected = users.length > 0 && selectedUsers.length === users.length;
  const isIndeterminate = selectedUsers.length > 0 && selectedUsers.length < users.length;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {t('users.adminTitle')}
            </h1>
            <p className="text-slate-600">
              {t('users.adminDescription')}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={openBulkAssign}
              disabled={selectedUsers.length === 0}
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              {t('users.bulkAssign')}
              {selectedUsers.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {selectedUsers.length}
                </Badge>
              )}
            </Button>
            <Button className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              {t('users.inviteUser')}
            </Button>
          </div>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-2">
                <UsersIcon className="h-5 w-5" />
                <span className="font-medium">
                  {t('users.totalUsers', { count: totalUsers })}
                </span>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2">
                {/* Search */}
                <div className="relative min-w-[300px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder={t('users.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                {/* Filters */}
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder={t('users.filterByRole')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('users.allRoles')}</SelectItem>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.code}>
                        {getRoleDisplayName(role.code)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder={t('users.filterByStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('users.allStatuses')}</SelectItem>
                    <SelectItem value="active">{t('users.active')}</SelectItem>
                    <SelectItem value="disabled">{t('users.disabled')}</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder={t('users.filterByProject')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('users.allProjects')}</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {isRTL ? project.nameAr || project.name : project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Users Table */}
        <Card>
          <CardContent className="p-0">
            {usersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12">
                <UsersIcon className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600">{t('users.noUsersFound')}</p>
                <p className="text-slate-500 text-sm mt-1">
                  {searchQuery ? t('users.tryDifferentSearch') : t('users.startByInviting')}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label={t('users.selectAll')}
                        ref={(el) => {
                          if (el) el.indeterminate = isIndeterminate;
                        }}
                      />
                    </TableHead>
                    <TableHead>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="font-medium"
                        onClick={() => {
                          if (sortBy === 'name') {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortBy('name');
                            setSortOrder('asc');
                          }
                        }}
                      >
                        {t('users.user')}
                        {sortBy === 'name' && (
                          <ChevronDown className={cn("ml-2 h-4 w-4", sortOrder === 'desc' && "rotate-180")} />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead>{t('users.orgRoles')}</TableHead>
                    <TableHead>{t('users.projectRoles')}</TableHead>
                    <TableHead>{t('users.status')}</TableHead>
                    <TableHead>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="font-medium"
                        onClick={() => {
                          if (sortBy === 'lastActive') {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortBy('lastActive');
                            setSortOrder('desc');
                          }
                        }}
                      >
                        {t('users.lastActive')}
                        {sortBy === 'lastActive' && (
                          <ChevronDown className={cn("ml-2 h-4 w-4", sortOrder === 'desc' && "rotate-180")} />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user: User) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedUsers.includes(user.id)}
                          onCheckedChange={(checked) => handleUserSelect(user.id, !!checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <UserAvatar user={user} size="sm" />
                          <div>
                            <div className="font-medium text-slate-900">
                              {user.firstName && user.lastName 
                                ? `${user.firstName} ${user.lastName}`
                                : user.name || user.email
                              }
                              {user.id === currentUser?.id && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  {t('users.you')}
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-slate-500">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.userRoles?.slice(0, 2).map((role) => (
                            <Badge key={role.id} variant={getRoleBadgeVariant(role.code)} className="text-xs">
                              {role.code}
                            </Badge>
                          ))}
                          {user.userRoles && user.userRoles.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{user.userRoles.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-500">
                          {/* TODO: Show project role count */}
                          {t('users.viewDetails')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(user.status || 'active')}>
                          {user.status === 'disabled' ? t('users.disabled') : t('users.active')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-500">
                          {user.lastActiveAt 
                            ? new Date(user.lastActiveAt).toLocaleDateString()
                            : t('users.never')
                          }
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openRolesDrawer(user)}>
                              <Edit className="h-4 w-4 mr-2" />
                              {t('users.editRoles')}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleStatusToggle(user.id, user.status || 'active')}
                            >
                              {user.status === 'disabled' ? (
                                <>
                                  <UserCheck className="h-4 w-4 mr-2" />
                                  {t('users.reactivate')}
                                </>
                              ) : (
                                <>
                                  <UserX className="h-4 w-4 mr-2" />
                                  {t('users.deactivate')}
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              {t('users.viewAudit')}
                            </DropdownMenuItem>
                            {user.id !== currentUser?.id && (
                              <DropdownMenuItem className="text-red-600">
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t('users.deleteUser')}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">
              {t('users.showingResults', { 
                start: (page - 1) * pageSize + 1,
                end: Math.min(page * pageSize, totalUsers),
                total: totalUsers
              })}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                {t('common.previous')}
              </Button>
              <span className="text-sm text-slate-600">
                {t('users.pageOfTotal', { page, total: totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
              >
                {t('common.next')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Roles Drawer */}
      <UserRolesDrawer
        user={selectedUser}
        isOpen={isRolesDrawerOpen}
        onClose={() => {
          setIsRolesDrawerOpen(false);
          setSelectedUser(null);
        }}
      />

      {/* Bulk Assign Dialog */}
      <BulkAssignDialog
        selectedUserIds={selectedUsers}
        isOpen={isBulkAssignOpen}
        onClose={() => {
          setIsBulkAssignOpen(false);
          setSelectedUsers([]);
        }}
      />
    </AppLayout>
  );
}