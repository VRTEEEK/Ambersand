import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/hooks/use-i18n';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Bell, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  FileText, 
  Users, 
  Calendar,
  Trash2,
  Mail
} from 'lucide-react';
import { cn } from '@/lib/utils';
import heroBackgroundPath from "@assets/image_1752308830644.png";

interface Notification {
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

const mockNotifications: Notification[] = [
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

export default function Notifications() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { language } = useI18n();
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task':
        return <CheckCircle2 className="h-5 w-5" />;
      case 'project':
        return <FileText className="h-5 w-5" />;
      case 'user':
        return <Users className="h-5 w-5" />;
      case 'system':
        return <Bell className="h-5 w-5" />;
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return language === 'ar' ? `منذ ${diffDays} يوم` : `${diffDays}d ago`;
    } else if (diffHours > 0) {
      return language === 'ar' ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
    } else {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return language === 'ar' ? `منذ ${diffMinutes} دقيقة` : `${diffMinutes}m ago`;
    }
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, isRead: true } : notif
      )
    );
  };

  const markAsUnread = (id: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, isRead: false } : notif
      )
    );
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, isRead: true }))
    );
  };

  const filteredNotifications = notifications.filter(notif => {
    if (filter === 'unread') return !notif.isRead;
    if (filter === 'read') return notif.isRead;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2699A6] mx-auto"></div>
            <p className="mt-4 text-slate-600">Loading...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Hero Section */}
        <div 
          className="relative overflow-hidden rounded-2xl"
          style={{
            backgroundImage: `url(${heroBackgroundPath})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-teal-600/90 via-teal-700/80 to-teal-800/90"></div>
          
          <div className="relative px-8 py-16 md:py-20">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
              <div className="text-center lg:text-left">
                
                
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 text-white/90">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                      <Bell className="h-4 w-4" />
                    </div>
                    <span className="font-semibold">{notifications.length} {language === 'ar' ? 'إشعار' : 'Notifications'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <span className="font-semibold">{unreadCount} {language === 'ar' ? 'غير مقروء' : 'Unread'}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-center lg:justify-end">
                <Button 
                  onClick={markAllAsRead}
                  className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm px-8 py-6 text-lg rounded-xl transition-all duration-200 hover:scale-105"
                  disabled={unreadCount === 0}
                >
                  <CheckCircle2 className="h-5 w-5 mr-3" />
                  {language === 'ar' ? 'تميز الكل كمقروء' : 'Mark All as Read'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
            className={cn(
              filter === 'all' && 'bg-[#2699A6] hover:bg-[#2699A6]/90'
            )}
          >
            {language === 'ar' ? 'الكل' : 'All'} ({notifications.length})
          </Button>
          <Button
            variant={filter === 'unread' ? 'default' : 'outline'}
            onClick={() => setFilter('unread')}
            className={cn(
              filter === 'unread' && 'bg-[#2699A6] hover:bg-[#2699A6]/90'
            )}
          >
            {language === 'ar' ? 'غير مقروء' : 'Unread'} ({unreadCount})
          </Button>
          <Button
            variant={filter === 'read' ? 'default' : 'outline'}
            onClick={() => setFilter('read')}
            className={cn(
              filter === 'read' && 'bg-[#2699A6] hover:bg-[#2699A6]/90'
            )}
          >
            {language === 'ar' ? 'مقروء' : 'Read'} ({notifications.length - unreadCount})
          </Button>
        </div>

        {/* Notifications List */}
        <Card className="border border-slate-200/60 dark:border-slate-700/60 shadow-xl backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Bell className="h-6 w-6 text-[#2699A6]" />
              {language === 'ar' ? 'قائمة الإشعارات' : 'Notification List'}
            </CardTitle>
            <CardDescription>
              {language === 'ar' ? 'جميع الإشعارات والتحديثات الخاصة بك' : 'All your notifications and updates'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {filteredNotifications.length === 0 ? (
              <div className="p-12 text-center">
                <Bell className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-600 mb-2">
                  {language === 'ar' ? 'لا توجد إشعارات' : 'No Notifications'}
                </h3>
                <p className="text-slate-500">
                  {filter === 'unread' 
                    ? (language === 'ar' ? 'جميع الإشعارات مقروءة' : 'All notifications are read')
                    : (language === 'ar' ? 'ستظهر الإشعارات هنا عند وصولها' : 'Notifications will appear here when they arrive')
                  }
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredNotifications.map((notification, index) => (
                  <div 
                    key={notification.id}
                    className={cn(
                      "p-6 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors duration-200",
                      !notification.isRead && "bg-blue-50/50 dark:bg-blue-900/10 border-l-4 border-l-[#2699A6]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center",
                          notification.type === 'task' ? 'bg-green-100 text-green-600' :
                          notification.type === 'project' ? 'bg-blue-100 text-blue-600' :
                          notification.type === 'user' ? 'bg-purple-100 text-purple-600' :
                          'bg-gray-100 text-gray-600'
                        )}>
                          {getNotificationIcon(notification.type)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-slate-900 dark:text-white">
                              {language === 'ar' ? notification.titleAr : notification.title}
                            </h3>
                            <Badge className={cn("text-xs", getPriorityColor(notification.priority))}>
                              {language === 'ar' ? (
                                notification.priority === 'urgent' ? 'عاجل' :
                                notification.priority === 'high' ? 'عالي' :
                                notification.priority === 'medium' ? 'متوسط' : 'منخفض'
                              ) : (
                                notification.priority.charAt(0).toUpperCase() + notification.priority.slice(1)
                              )}
                            </Badge>
                            {!notification.isRead && (
                              <div className="w-2 h-2 bg-[#2699A6] rounded-full"></div>
                            )}
                          </div>
                          
                          <p className="text-slate-600 dark:text-slate-400 mb-3">
                            {language === 'ar' ? notification.messageAr : notification.message}
                          </p>
                          
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Clock className="h-4 w-4" />
                            <span>{formatTime(notification.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {!notification.isRead ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => markAsRead(notification.id)}
                            title={language === 'ar' ? 'تميز كمقروء' : 'Mark as read'}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => markAsUnread(notification.id)}
                            title={language === 'ar' ? 'تميز كغير مقروء' : 'Mark as unread'}
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                        
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteNotification(notification.id)}
                          className="text-red-600 hover:text-red-700"
                          title={language === 'ar' ? 'حذف' : 'Delete'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}