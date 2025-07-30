import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/hooks/use-i18n';
import { useNotifications, type Notification } from '@/hooks/useNotifications';
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

export default function Notifications() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { language } = useI18n();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
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
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 60) {
      return language === 'ar' ? `منذ ${diffMinutes} دقيقة` : `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return language === 'ar' ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
    } else {
      return language === 'ar' ? `منذ ${diffDays} يوم` : `${diffDays}d ago`;
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread') return !notification.isRead;
    if (filter === 'read') return notification.isRead;
    return true;
  });

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
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
                  {language === 'ar' ? 'الإشعارات' : 'Notifications'}
                </h1>
                
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 text-white/90">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                      <Bell className="h-4 w-4" />
                    </div>
                    <span className="font-semibold">{notifications.length} {language === 'ar' ? 'إشعار' : 'Notifications'}</span>
                  </div>
                  
                  <Separator orientation="vertical" className="h-6 bg-white/30" />
                  
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                      <Mail className="h-4 w-4" />
                    </div>
                    <span className="font-semibold">{unreadCount} {language === 'ar' ? 'غير مقروء' : 'Unread'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
              className={filter === 'all' ? 'bg-[#2699A6] hover:bg-[#1e7a85]' : ''}
            >
              {language === 'ar' ? 'الكل' : 'All'} ({notifications.length})
            </Button>
            <Button
              variant={filter === 'unread' ? 'default' : 'outline'}
              onClick={() => setFilter('unread')}
              className={filter === 'unread' ? 'bg-[#2699A6] hover:bg-[#1e7a85]' : ''}
            >
              {language === 'ar' ? 'غير مقروء' : 'Unread'} ({unreadCount})
            </Button>
            <Button
              variant={filter === 'read' ? 'default' : 'outline'}
              onClick={() => setFilter('read')}
              className={filter === 'read' ? 'bg-[#2699A6] hover:bg-[#1e7a85]' : ''}
            >
              {language === 'ar' ? 'مقروء' : 'Read'} ({notifications.length - unreadCount})
            </Button>
          </div>

          {unreadCount > 0 && (
            <Button
              variant="outline"
              onClick={markAllAsRead}
              className="flex items-center gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              {language === 'ar' ? 'تحديد الكل كمقروء' : 'Mark All as Read'}
            </Button>
          )}
        </div>

        {/* Notifications List */}
        <div className="space-y-4">
          {filteredNotifications.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Bell className="h-12 w-12 text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-600 mb-2">
                  {language === 'ar' ? 'لا توجد إشعارات' : 'No notifications'}
                </p>
                <p className="text-gray-500 text-center">
                  {language === 'ar' 
                    ? 'ستظهر الإشعارات الجديدة هنا عند توفرها'
                    : 'New notifications will appear here when available'
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredNotifications.map((notification) => (
              <Card 
                key={notification.id} 
                className={cn(
                  "transition-all duration-200 hover:shadow-md cursor-pointer",
                  !notification.isRead ? 'bg-blue-50/50 border-l-4 border-l-[#2699A6]' : 'hover:bg-gray-50'
                )}
                onClick={() => {
                  if (!notification.isRead) {
                    markAsRead(notification.id);
                  }
                  if (notification.actionUrl) {
                    window.location.href = notification.actionUrl;
                  }
                }}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        notification.type === 'task' ? 'bg-blue-100 text-blue-600' :
                        notification.type === 'project' ? 'bg-green-100 text-green-600' :
                        notification.type === 'user' ? 'bg-purple-100 text-purple-600' :
                        'bg-gray-100 text-gray-600'
                      )}>
                        {getNotificationIcon(notification.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {language === 'ar' ? notification.titleAr : notification.title}
                          </h3>
                          <Badge 
                            variant="outline" 
                            className={cn("text-xs", getPriorityColor(notification.priority))}
                          >
                            {language === 'ar' 
                              ? notification.priority === 'urgent' ? 'عاجل' :
                                notification.priority === 'high' ? 'عالي' :
                                notification.priority === 'medium' ? 'متوسط' : 'منخفض'
                              : notification.priority
                            }
                          </Badge>
                        </div>
                        
                        <p className="text-gray-600 text-sm mb-3">
                          {language === 'ar' ? notification.messageAr : notification.message}
                        </p>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTime(notification.createdAt)}
                          </div>
                          
                          {!notification.isRead && (
                            <Badge className="bg-[#2699A6] text-white">
                              {language === 'ar' ? 'جديد' : 'New'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}