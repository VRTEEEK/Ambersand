import { useState, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/hooks/use-i18n';
import { useToast } from '@/hooks/use-toast';
import { usePermissions, PERMISSIONS } from '@/hooks/use-permissions';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
// Simple inline debounce to avoid import issues
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
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
  Loader2,
  Activity,
  KeyRound
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ProjectRoleSummary from './ProjectRoleSummary';
import AuditModal from './AuditModal';
import InviteUserDialog from './InviteUserDialog';

interface ProjectRole {
  projectId: string;
  projectName: string;
  roles: { code: string; name?: string }[];
}

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
  projectRoles?: ProjectRole[];
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
  const [auditUser, setAuditUser] = useState<User | null>(null);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  
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

  // Check if current user is the last admin (guard rails) - after usersResponse is available
  const isLastAdmin = useMemo(() => {
    if (!currentUser || !usersResponse || !Array.isArray(usersResponse.users)) return false;
    const activeAdmins = usersResponse.users
      .filter((u: User) => u.status !== 'disabled')
      .filter((u: User) => u.userRoles?.some(r => r.code === 'admin'));
    return activeAdmins.length === 1 && activeAdmins[0].id === (currentUser as any).id;
  }, [currentUser, usersResponse]);

  // Mutations
  const updateUserStatusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: 'active' | 'disabled' }) =>
      apiRequest(`/api/users/${userId}/status`, 'POST', { status }),
    onSuccess: () => {
      // Invalidate all admin users queries
      queryClient.invalidateQueries({
        predicate: (query) => String(query.queryKey[0]).startsWith('/api/admin/users')
      });
      queryClient.invalidateQueries({ queryKey: ['/api/me/permissions'] });
      toast({ title: 'Status Updated' });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Status Update Error',
        description: error.message || 'Failed to update user status',
      });
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
    if (checked && usersResponse?.users) {
      setSelectedUsers(usersResponse.users.map((u: User) => u.id));
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
      'admin': 'Admin',
      'user': 'User',
      'officer': 'Officer', 
      'collaborator': 'Collaborator',
      'viewer': 'Viewer'
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
            Access Denied
          </h2>
          <p className="text-slate-600 max-w-md">
            You don't have permission to access user management
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
              User Management
            </h1>
            <p className="text-slate-600">
              Manage user roles, permissions and access control
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
              Bulk Assign
              {selectedUsers.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {selectedUsers.length}
                </Badge>
              )}
            </Button>
            <Button 
              className="flex items-center gap-2"
              onClick={() => setIsInviteDialogOpen(true)}
            >
              <UserPlus className="h-4 w-4" />
              Invite User
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
                  Total Users: {totalUsers}
                </span>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2">
                {/* Search */}
                <div className="relative min-w-[300px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                {/* Filters */}
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.code}>
                        {getRoleDisplayName(role.code)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Filter by project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
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
                <p className="text-slate-600">No users found</p>
                <p className="text-slate-500 text-sm mt-1">
                  {searchQuery ? 'Try a different search term' : 'Start by inviting your first user'}
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
                        aria-label="Select all users"
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
                        User
                        {sortBy === 'name' && (
                          <ChevronDown className={cn("ml-2 h-4 w-4", sortOrder === 'desc' && "rotate-180")} />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead>Organization Roles</TableHead>
                    <TableHead>Project Roles</TableHead>
                    <TableHead>Status</TableHead>
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
                        Last Active
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
                              {user.id === (currentUser as any)?.id && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  You
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
                            <Badge key={role.id} variant={getRoleBadgeVariant(role.code) as any} className="text-xs">
                              {getRoleDisplayName(role.code)}
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
                        <ProjectRoleSummary roles={user.projectRoles || []} />
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(user.status || 'active')}>
                          {user.status === 'disabled' ? 'Disabled' : 'Active'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-500">
                          {user.lastActiveAt 
                            ? new Date(user.lastActiveAt).toLocaleDateString()
                            : 'Never'
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
                              Edit Roles
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleStatusToggle(user.id, user.status || 'active')}
                              disabled={user.id === (currentUser as any)?.id && isLastAdmin && user.status === 'active'}
                            >
                              {user.status === 'disabled' ? (
                                <>
                                  <UserCheck className="h-4 w-4 mr-2" />
                                  Reactivate
                                </>
                              ) : (
                                <>
                                  <UserX className="h-4 w-4 mr-2" />
                                  Deactivate
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setAuditUser(user)}>
                              <Activity className="h-4 w-4 mr-2" />
                              View Audit
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <KeyRound className="h-4 w-4 mr-2" />
                              Reset Password
                            </DropdownMenuItem>
                            {user.id !== (currentUser as any)?.id && !isLastAdmin && (
                              <DropdownMenuItem className="text-red-600">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete User
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
              Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalUsers)} of {totalUsers} results
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-slate-600">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
              >
                Next
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

      {/* Audit Modal */}
      {auditUser && (
        <AuditModal 
          userId={auditUser.id}
          userName={auditUser.name || auditUser.email || ''}
          open={!!auditUser}
          onClose={() => setAuditUser(null)}
        />
      )}

      {/* Invite User Dialog */}
      <InviteUserDialog
        isOpen={isInviteDialogOpen}
        onClose={() => setIsInviteDialogOpen(false)}
      />
    </AppLayout>
  );
}