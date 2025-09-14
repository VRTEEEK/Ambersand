import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { NotificationProvider } from "@/hooks/useNotifications";
import { PermissionsProvider } from "@/hooks/use-permissions";
import { SupportButton } from "@/components/support/SupportButton";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Landing from "@/pages/Landing";
import Regulations from "@/pages/Regulations";
import ImportRegulation from "@/pages/regulations/ImportRegulation";
import { RegulationDetail } from "@/pages/regulations/RegulationDetail";
import Projects from "@/pages/Projects";
import Tasks from "@/pages/Tasks";
import MyTasks from "@/pages/MyTasks";
import Evidence from "@/pages/Evidence";
import ProjectDetail from "@/pages/ProjectDetail";
import TaskDetail from "@/pages/TaskDetail";
import AnalyticsReports from "@/pages/AnalyticsReports";
import Settings from "@/pages/Settings";
import UserProfile from "@/pages/UserProfile";
import Users from "@/pages/Users";
import EnhancedUsersPage from "@/components/users/EnhancedUsersPage";
import Notifications from "@/pages/Notifications";
import EmailTest from "@/pages/EmailTest";
import RiskRegister from "@/pages/RiskRegister";
import RiskDetailPage from "@/pages/RiskDetailPage";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading state while authentication is being determined
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/" component={isAuthenticated ? Dashboard : Landing} />
      <Route path="/regulations" component={isAuthenticated ? Regulations : Landing} />
      <Route path="/regulations/import" component={isAuthenticated ? ImportRegulation : Landing} />
      <Route path="/regulations/:id" component={isAuthenticated ? RegulationDetail : Landing} />
      <Route path="/projects" component={isAuthenticated ? Projects : Landing} />
      <Route path="/projects/:id" component={isAuthenticated ? ProjectDetail : Landing} />
      <Route path="/my-tasks" component={isAuthenticated ? MyTasks : Landing} />
      <Route path="/tasks" component={isAuthenticated ? Tasks : Landing} />
      <Route path="/tasks/:id" component={isAuthenticated ? TaskDetail : Landing} />
      <Route path="/risks" component={isAuthenticated ? RiskRegister : Landing} />
      <Route path="/risks/:id" component={isAuthenticated ? RiskDetailPage : Landing} />
      <Route path="/evidence" component={isAuthenticated ? Evidence : Landing} />
      <Route path="/analytics" component={isAuthenticated ? AnalyticsReports : Landing} />
      <Route path="/users" component={isAuthenticated ? Users : Landing} />
      <Route path="/admin/users" component={isAuthenticated ? EnhancedUsersPage : Landing} />
      <Route path="/notifications" component={isAuthenticated ? Notifications : Landing} />
      <Route path="/email-test" component={isAuthenticated ? EmailTest : Landing} />
      <Route path="/settings" component={isAuthenticated ? Settings : Landing} />
      <Route path="/profile" component={isAuthenticated ? UserProfile : Landing} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated } = useAuth();
  
  return (
    <>
      <Router />
      <Toaster />
      {/* Floating Support button at bottom-left - outside router context */}
      {isAuthenticated && <SupportButton />}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>
        <PermissionsProvider>
          <TooltipProvider>
            <AppContent />
          </TooltipProvider>
        </PermissionsProvider>
      </NotificationProvider>
    </QueryClientProvider>
  );
}

export default App;
