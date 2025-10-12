import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import logoPath from "@assets/Logo_1752310054852.png";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const verifyEmail = async () => {
      // Get token from URL query params
      const params = new URLSearchParams(searchString);
      const token = params.get("token");

      if (!token) {
        setStatus("error");
        setMessage("Verification token is missing. Please check your email link.");
        return;
      }

      try {
        const response = await fetch(`/api/auth/verify-email?token=${token}`);
        const data = await response.json();

        if (response.ok) {
          setStatus("success");
          setMessage(data.message || "Email verified successfully!");

          // Redirect to login after 3 seconds
          setTimeout(() => {
            setLocation("/auth/login");
          }, 3000);
        } else {
          setStatus("error");
          setMessage(data.message || "Email verification failed. The link may be expired or invalid.");
        }
      } catch (err) {
        console.error("Verification error:", err);
        setStatus("error");
        setMessage("An unexpected error occurred. Please try again.");
      }
    };

    verifyEmail();
  }, [searchString, setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-teal-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <img src={logoPath} alt="Ambersand" className="h-12 mx-auto" />
          <div>
            <CardTitle className="text-2xl font-bold">Email Verification</CardTitle>
            <CardDescription>
              {status === "loading" && "Verifying your email address..."}
              {status === "success" && "Your email has been verified!"}
              {status === "error" && "Verification failed"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "loading" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-12 w-12 animate-spin text-teal-600" />
              <p className="text-sm text-gray-600">Please wait...</p>
            </div>
          )}

          {status === "success" && (
            <>
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <Alert className="border-green-200 bg-green-50">
                  <AlertDescription className="text-green-800">{message}</AlertDescription>
                </Alert>
              </div>
              <p className="text-sm text-center text-gray-600">
                Redirecting to login page...
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
                <Alert variant="destructive">
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              </div>
              <Button className="w-full" onClick={() => setLocation("/auth/login")}>
                Go to Login
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
