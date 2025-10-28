import { createContext, useContext, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface Notification {
  id: number;
  title: string;
  titleAr?: string;
  message: string;
  messageAr?: string;
  type: string;
  priority: string;
  actionUrl?: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (id: number) => void;
  markAllAsRead: () => void;
  refreshNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // Check if user is authenticated by looking for access token
  const hasToken = !!localStorage.getItem("accessToken");

  // Fetch notifications - only if authenticated
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['/api/notifications'],
    enabled: hasToken, // Only fetch if user has token
    staleTime: 30000, // 30 seconds
    refetchInterval: hasToken ? 60000 : false, // Only refetch if authenticated
  });

  // Fetch unread count - only if authenticated
  const { data: unreadData } = useQuery({
    queryKey: ['/api/notifications/unread-count'],
    enabled: hasToken, // Only fetch if user has token
    staleTime: 30000,
    refetchInterval: hasToken ? 30000 : false, // Only refetch if authenticated
  });

  const unreadCount = (unreadData as { count: number } | undefined)?.count || 0;

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/notifications/${id}/read`, 'PATCH');
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate both queries
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/notifications/mark-all-read', 'PATCH');
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate both queries
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
  });

  const markAsRead = (id: number) => {
    markAsReadMutation.mutate(id);
  };

  const markAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const refreshNotifications = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
  };

  return (
    <NotificationContext.Provider value={{
      notifications: notifications as Notification[],
      unreadCount,
      isLoading,
      markAsRead,
      markAllAsRead,
      refreshNotifications
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}