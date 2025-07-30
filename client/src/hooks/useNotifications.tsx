import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Notification {
  id: string;
  title: string;
  titleAr: string;
  message: string;
  messageAr: string;
  type: 'task' | 'project' | 'user' | 'system';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  refreshNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Mock notifications data - in a real app this would come from API
const initialNotifications: Notification[] = [
  {
    id: '1',
    title: 'New Task Assigned',
    titleAr: 'مهمة جديدة مُسندة',
    message: 'You have been assigned a new compliance task for ECC control 1-2-3',
    messageAr: 'تم إسناد مهمة امتثال جديدة لك للضابط ECC 1-2-3',
    type: 'task',
    priority: 'high',
    isRead: false,
    createdAt: '2025-07-12T09:45:00Z',
    actionUrl: '/tasks'
  },
  {
    id: '2',
    title: 'Project Status Updated',
    titleAr: 'تم تحديث حالة المشروع',
    message: 'Project "Cybersecurity Framework" has been marked as completed',
    messageAr: 'تم وضع علامة على مشروع "إطار الأمن السيبراني" كمكتمل',
    type: 'project',
    priority: 'medium',
    isRead: false,
    createdAt: '2025-07-12T08:30:00Z',
    actionUrl: '/projects'
  },
  {
    id: '3',
    title: 'New User Added',
    titleAr: 'تم إضافة مستخدم جديد',
    message: 'A new user "Ahmed Mohammed" has been added to your organization',
    messageAr: 'تم إضافة مستخدم جديد "أحمد محمد" إلى منظمتك',
    type: 'user',
    priority: 'low',
    isRead: true,
    createdAt: '2025-07-12T07:15:00Z',
    actionUrl: '/users'
  },
  {
    id: '4',
    title: 'Compliance Report Ready',
    titleAr: 'تقرير الامتثال جاهز',
    message: 'Your monthly compliance report is now available for download',
    messageAr: 'تقرير الامتثال الشهري متاح الآن للتحميل',
    type: 'system',
    priority: 'medium',
    isRead: true,
    createdAt: '2025-07-12T06:00:00Z',
    actionUrl: '/analytics'
  },
  {
    id: '5',
    title: 'Urgent: Deadline Approaching',
    titleAr: 'عاجل: اقتراب الموعد النهائي',
    message: 'Task "Security Assessment" is due tomorrow',
    messageAr: 'مهمة "تقييم الأمن" مستحقة غداً',
    type: 'task',
    priority: 'urgent',
    isRead: false,
    createdAt: '2025-07-11T18:00:00Z',
    actionUrl: '/tasks'
  }
];

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    // Load from localStorage if available
    const stored = localStorage.getItem('notifications');
    return stored ? JSON.parse(stored) : initialNotifications;
  });

  // Save to localStorage whenever notifications change
  useEffect(() => {
    localStorage.setItem('notifications', JSON.stringify(notifications));
  }, [notifications]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, isRead: true }
          : notification
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, isRead: true }))
    );
  };

  const refreshNotifications = () => {
    // In a real app, this would fetch from API
    // For now, we'll keep the current notifications
    console.log('Refreshing notifications...');
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
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