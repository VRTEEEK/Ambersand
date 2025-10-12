import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Mail, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AcceptInvite() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, loginWithRedirect } = useAuth();
  const { toast } = useToast();

  const [inviteData, setInviteData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Get token from URL
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  useEffect(() => {
    if (!token) {
      setError("Invalid invitation link - missing token");
      setLoading(false);
      return;
    }

    // Fetch invite details
    const fetchInvite = async () => {
      try {
        const response = await fetch(`/api/users/invite/${token}`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || "Invalid or expired invitation");
        }
        const data = await response.json();
        setInviteData(data);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || "Failed to load invitation");
        setLoading(false);
      }
    };

    fetchInvite();
  }, [token]);

  useEffect(() => {
    // Auto-accept if user is authenticated and invite is loaded
    if (isAuthenticated && inviteData && !accepting && !success && !error) {
      handleAccept();
    }
  }, [isAuthenticated, inviteData, authLoading]);

  const handleAccept = async () => {
    if (!token) return;

    setAccepting(true);
    try {
      const response = await fetch("/api/users/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to accept invitation");
      }

      if (data.requiresSignup) {
        // User needs to sign up first
        toast({
          title: "Sign up required",
          description: "Please sign up or log in to accept this invitation",
        });
        // Redirect to login with return URL
        loginWithRedirect?.(`/accept-invite?token=${token}`);
        return;
      }

      setSuccess(true);
      toast({
        title: "Invitation accepted!",
        description: data.assignedTasks?.length
          ? `${data.assignedTasks.length} task(s) have been assigned to you`
          : "Welcome to the team!",
      });

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        setLocation("/");
      }, 2000);

    } catch (err: any) {
      setError(err.message || "Failed to accept invitation");
      toast({
        title: "Error",
        description: err.message || "Failed to accept invitation",
        variant: "destructive",
      });
    } finally {
      setAccepting(false);
    }
  };

  const handleSignUp = () => {
    // Redirect to Replit auth login, which will come back here after auth
    loginWithRedirect?.(`/accept-invite?token=${token}`);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-blue-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
              <p className="text-gray-600">Loading invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-blue-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-6 w-6 text-red-500" />
              <CardTitle>Invitation Error</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-4">{error}</p>
            <Button onClick={() => setLocation("/")} variant="outline" className="w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-blue-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <CardTitle>Invitation Accepted!</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-4">
              Welcome to Ambersand Compliance! Redirecting you to the dashboard...
            </p>
            <div className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-blue-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Mail className="h-6 w-6 text-teal-600" />
              <CardTitle>You're Invited!</CardTitle>
            </div>
            <CardDescription>
              Join Ambersand Compliance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                <strong>Email:</strong> {inviteData?.email}
              </p>
              <p className="text-sm text-gray-700 mt-1">
                <strong>Role:</strong> {inviteData?.role || "Member"}
              </p>
            </div>

            <p className="text-gray-600">
              You've been invited to join an organization on Ambersand.
              Sign up or log in to accept this invitation.
            </p>

            <Button
              onClick={handleSignUp}
              className="w-full bg-teal-600 hover:bg-teal-700"
              disabled={accepting}
            >
              {accepting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Sign Up / Log In"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-blue-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Mail className="h-6 w-6 text-teal-600" />
            <CardTitle>Accept Invitation</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              <strong>Email:</strong> {inviteData?.email}
            </p>
            <p className="text-sm text-gray-700 mt-1">
              <strong>Role:</strong> {inviteData?.role || "Member"}
            </p>
          </div>

          <p className="text-gray-600">
            Accept this invitation to join the organization and access your assigned tasks.
          </p>

          <Button
            onClick={handleAccept}
            className="w-full bg-teal-600 hover:bg-teal-700"
            disabled={accepting}
          >
            {accepting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Accepting...
              </>
            ) : (
              "Accept Invitation"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
