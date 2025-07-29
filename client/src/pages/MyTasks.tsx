import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Separator } from "@/components/ui/separator";
import { MetricsCard } from "@/components/dashboard/MetricsCard";
import { 
  Calendar, 
  Clock, 
  Search, 
  Filter, 
  Eye,
  CheckSquare,
  AlertCircle,
  Clock3,
  Grid,
  List,
  CheckCircle,
  Play,
  AlertTriangle,
  Zap
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/use-i18n";
import AppLayout from "@/components/layout/AppLayout";
import type { Task, User as UserType, Project } from "@shared/schema";

interface TaskWithDetails extends Task {
  project?: Project;
  assignee?: UserType;
  createdBy?: UserType;
}

export default function MyTasks() {
  const { user } = useAuth();
  const { t, language, isRTL } = useI18n();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [regulationFilter, setRegulationFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  // Get my tasks (assigned to current user)
  const { data: myTasks = [], isLoading } = useQuery<TaskWithDetails[]>({
    queryKey: ["/api/tasks", { assigneeId: (user as any)?.id }],
    queryFn: async () => {
      const response = await fetch(`/api/tasks?assigneeId=${(user as any)?.id}`);
      if (!response.ok) throw new Error('Failed to fetch my tasks');
      return response.json();
    },
    enabled: !!(user as any)?.id
  });

  // Filter tasks based on search and filters
  const filteredTasks = myTasks.filter(task => {
    const matchesSearch = !search || 
      task.title.toLowerCase().includes(search.toLowerCase()) ||
      (task.titleAr && task.titleAr.includes(search)) ||
      (task.description && task.description.toLowerCase().includes(search.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
    const matchesRegulation = regulationFilter === "all" || 
      (task.project && task.project.regulationType === regulationFilter);
    
    return matchesSearch && matchesStatus && matchesPriority && matchesRegulation;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "high": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "medium": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "low": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "in-progress": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "pending": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "cancelled": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgent": return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "high": return <Clock3 className="h-4 w-4 text-orange-600" />;
      case "medium": return <Clock className="h-4 w-4 text-yellow-600" />;
      case "low": return <CheckSquare className="h-4 w-4 text-green-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-8 w-8 text-teal-600" />
            <h1 className="text-3xl font-bold">My Tasks</h1>
          </div>
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">Loading your tasks...</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-8 w-8 text-teal-600" />
            <div>
              <h1 className="text-3xl font-bold">My Tasks</h1>
              <p className="text-muted-foreground">
                Tasks assigned to you ({filteredTasks.length} of {myTasks.length})
              </p>
            </div>
          </div>
          
          {/* View Toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'cards' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('cards')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        {myTasks.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricsCard
              title="Pending Tasks"
              value={myTasks.filter(t => t.status === "pending").length}
              icon={Clock}
              iconColor="#f59e0b"
            />
            <MetricsCard
              title="In Progress"
              value={myTasks.filter(t => t.status === "in-progress").length}
              icon={Play}
              iconColor="#3b82f6"
            />
            <MetricsCard
              title="Completed"
              value={myTasks.filter(t => t.status === "completed").length}
              icon={CheckCircle}
              iconColor="#10b981"
            />
            <MetricsCard
              title="Urgent Priority"
              value={myTasks.filter(t => t.priority === "urgent").length}
              icon={Zap}
              iconColor="#ef4444"
            />
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search tasks..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={regulationFilter} onValueChange={setRegulationFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Regulation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regulations</SelectItem>
                  <SelectItem value="ecc">ECC</SelectItem>
                  <SelectItem value="pdpl">PDPL</SelectItem>
                  <SelectItem value="ndmo">NDMO</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tasks Display */}
        {filteredTasks.length === 0 ? (
          <Card>
            <CardContent className="pt-8 pb-8">
              <div className="text-center">
                <CheckSquare className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No tasks found</h3>
                <p className="text-muted-foreground">
                  {myTasks.length === 0 
                    ? "You don't have any tasks assigned to you yet."
                    : "No tasks match your current filters."
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Card View */}
            {viewMode === 'cards' && (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredTasks.map((task) => (
                  <Card key={task.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg line-clamp-2 mb-2">
                            {task.title}
                          </CardTitle>
                          {task.titleAr && (
                            <p className="text-sm text-muted-foreground mb-2" dir="rtl">
                              {task.titleAr}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          {getPriorityIcon(task.priority)}
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Badge className={getStatusColor(task.status)} variant="secondary">
                          {task.status}
                        </Badge>
                        <Badge className={getPriorityColor(task.priority)} variant="secondary">
                          {task.priority}
                        </Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        {task.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {task.description}
                          </p>
                        )}
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>Due: {task.dueDate ? format(new Date(task.dueDate), "MMM d, yyyy") : "Not set"}</span>
                          </div>
                          
                          {task.project && (
                            <div className="flex items-center gap-2">
                              <div className="h-4 w-4 bg-teal-600 rounded-sm flex-shrink-0" />
                              <span className="truncate">{task.project.name}</span>
                            </div>
                          )}
                        </div>
                        
                        <Separator />
                        
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-muted-foreground">
                            Created {task.createdAt ? format(new Date(task.createdAt), "MMM d") : "Unknown"}
                          </div>
                          
                          <Link href={`/tasks/${task.id}`}>
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {filteredTasks.map((task) => (
                      <Link key={task.id} href={`/tasks/${task.id}`}>
                        <div className="p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="flex items-center gap-1">
                                  {getPriorityIcon(task.priority)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-medium text-sm truncate">
                                    {task.title}
                                  </h3>
                                  {task.titleAr && (
                                    <p className="text-xs text-muted-foreground truncate" dir="rtl">
                                      {task.titleAr}
                                    </p>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  <span>Due: {task.dueDate ? format(new Date(task.dueDate), "MMM d") : "Not set"}</span>
                                </div>
                                
                                {task.project && (
                                  <div className="flex items-center gap-1">
                                    <div className="h-3 w-3 bg-teal-600 rounded-sm" />
                                    <span className="truncate max-w-32">{task.project.name}</span>
                                  </div>
                                )}
                                
                                <span>Created {task.createdAt ? format(new Date(task.createdAt), "MMM d") : "Unknown"}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3 ml-4">
                              <div className="flex gap-2">
                                <Badge className={`${getStatusColor(task.status)} text-xs px-2 py-1`} variant="secondary">
                                  {task.status}
                                </Badge>
                                <Badge className={`${getPriorityColor(task.priority)} text-xs px-2 py-1`} variant="secondary">
                                  {task.priority}
                                </Badge>
                              </div>
                              
                              <div className="flex items-center">
                                <Eye className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}


      </div>
    </AppLayout>
  );
}