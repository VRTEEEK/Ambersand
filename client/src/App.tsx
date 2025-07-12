import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/contexts/ThemeContext";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Landing from "@/pages/Landing";
import Regulations from "@/pages/Regulations";
import Projects from "@/pages/Projects";
import Tasks from "@/pages/Tasks";
import Evidence from "@/pages/Evidence";
import ProjectDetail from "@/pages/ProjectDetail";
import Analytics from "@/pages/Analytics";
import Settings from "@/pages/Settings";
import UserProfile from "@/pages/UserProfile";
import Users from "@/pages/Users";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/regulations" component={Regulations} />
          <Route path="/projects" component={Projects} />
          <Route path="/projects/:id" component={ProjectDetail} />
          <Route path="/tasks" component={Tasks} />
          <Route path="/evidence" component={Evidence} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/users" component={Users} />
          <Route path="/settings" component={Settings} />
          <Route path="/profile" component={UserProfile} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
