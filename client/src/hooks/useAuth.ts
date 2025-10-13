import { useQuery, useQueryClient } from "@tanstack/react-query";

export function useAuth() {
  const queryClient = useQueryClient();

  // Check if user is authenticated by looking for access token
  const hasToken = !!localStorage.getItem("accessToken");

  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        console.log("[useAuth] No access token found");
        throw new Error("No access token");
      }

      console.log("[useAuth] Fetching user with token");
      const response = await fetch("/api/auth/user", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.log("[useAuth] Failed to fetch user:", response.status);
        // Try to refresh token
        const refreshToken = localStorage.getItem("refreshToken");
        if (refreshToken) {
          const refreshResponse = await fetch("/api/auth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshResponse.ok) {
            console.log("[useAuth] Token refreshed successfully");
            const data = await refreshResponse.json();
            localStorage.setItem("accessToken", data.data.accessToken);
            localStorage.setItem("refreshToken", data.data.refreshToken);

            // Retry with new token
            const retryResponse = await fetch("/api/auth/user", {
              headers: {
                "Authorization": `Bearer ${data.data.accessToken}`,
              },
            });

            if (!retryResponse.ok) {
              console.log("[useAuth] Retry after refresh failed:", retryResponse.status);
              throw new Error("Failed to fetch user");
            }

            const userData = await retryResponse.json();
            console.log("[useAuth] User fetched successfully after refresh:", userData.data?.email);
            return userData.data || userData;
          }
        }

        // If refresh failed, clear tokens
        console.log("[useAuth] Refresh failed, clearing tokens");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        throw new Error("Unauthorized");
      }

      const userData = await response.json();
      console.log("[useAuth] User fetched successfully:", userData.data?.email);
      return userData.data || userData;
    },
    enabled: hasToken,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const logout = async () => {
    const accessToken = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");

    if (accessToken && refreshToken) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refreshToken }),
        });
      } catch (err) {
        console.error("Logout error:", err);
      }
    }

    // Clear local storage
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");

    // Clear query cache
    queryClient.clear();

    // Redirect to login
    window.location.href = "/auth/login";
  };

  const loginWithRedirect = (returnUrl?: string) => {
    // Store the return URL in sessionStorage to redirect back after login
    if (returnUrl) {
      sessionStorage.setItem("returnUrl", returnUrl);
    }
    
    // Redirect to login page
    window.location.href = "/auth/login";
  };

  return {
    user,
    isLoading: hasToken && isLoading,
    isAuthenticated: !!user && !error,
    logout,
    loginWithRedirect,
  };
}
