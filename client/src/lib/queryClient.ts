import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  url: string,
  method: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Get access token from localStorage
  let token = localStorage.getItem("accessToken");

  console.log(`[apiRequest] ${method} ${url}`, 'with auth:', !!token);

  // Build headers with Authorization if token exists
  const headers: Record<string, string> = {};
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // If we get a 401, try to refresh the token and retry
  if (res.status === 401) {
    console.log(`[apiRequest] Got 401, attempting token refresh`);
    const refreshToken = localStorage.getItem("refreshToken");
    
    if (refreshToken) {
      try {
        const refreshResponse = await fetch("/api/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshResponse.ok) {
          console.log("[apiRequest] Token refreshed successfully");
          const refreshData = await refreshResponse.json();
          const newAccessToken = refreshData.data.accessToken;
          const newRefreshToken = refreshData.data.refreshToken;
          
          localStorage.setItem("accessToken", newAccessToken);
          localStorage.setItem("refreshToken", newRefreshToken);

          // Retry original request with new token
          const newHeaders: Record<string, string> = {};
          if (data) {
            newHeaders["Content-Type"] = "application/json";
          }
          newHeaders["Authorization"] = `Bearer ${newAccessToken}`;

          res = await fetch(url, {
            method,
            headers: newHeaders,
            body: data ? JSON.stringify(data) : undefined,
            credentials: "include",
          });
        } else {
          console.log("[apiRequest] Token refresh failed");
          // Clear tokens and redirect to login
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          window.location.href = "/login";
          throw new Error("401: Session expired, please login again");
        }
      } catch (error) {
        console.error("[apiRequest] Error during token refresh:", error);
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.href = "/login";
        throw error;
      }
    } else {
      // No refresh token available, redirect to login
      console.log("[apiRequest] No refresh token available");
      localStorage.removeItem("accessToken");
      window.location.href = "/login";
      throw new Error("401: No refresh token available");
    }
  }

  if (!res.ok) {
    console.error(`[apiRequest] ${method} ${url} failed with status ${res.status}`);
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Get access token from localStorage
    const token = localStorage.getItem("accessToken");

    // Build headers with Authorization if token exists
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Extract URL from queryKey - it's always the first element and should be a string
    // Additional elements in the array are for cache invalidation/refetch tracking
    const url = Array.isArray(queryKey) ? String(queryKey[0]) : String(queryKey);

    console.log('[queryClient] Fetching:', url, 'with auth:', !!token);

    const res = await fetch(url, {
      credentials: "include",
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      console.log('[queryClient] 401 Unauthorized for:', url);
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
