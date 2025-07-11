import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/hooks/use-i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  FolderOpen,
  Globe,
  Menu,
  Search,
  Settings,
  Shield,
  ListTodo,
  Upload,
  Users,
  Bell,
  LayoutDashboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const { t, language, toggleLanguage, isRTL } = useI18n();
  const [notificationCount] = useState(3);

  const navigationItems = [
    {
      title: t('nav.dashboard'),
      href: '/',
      icon: LayoutDashboard,
      current: location === '/',
    },
    {
      title: t('nav.regulations'),
      href: '/regulations',
      icon: BookOpen,
      current: location === '/regulations',
    },
    {
      title: t('nav.projects'),
      href: '/projects',
      icon: FolderOpen,
      current: location === '/projects',
    },
    {
      title: t('nav.tasks'),
      href: '/tasks',
      icon: ListTodo,
      current: location === '/tasks',
    },
    {
      title: t('nav.evidence'),
      href: '/evidence',
      icon: Upload,
      current: location === '/evidence',
    },
    {
      title: t('nav.analytics'),
      href: '/analytics',
      icon: BarChart3,
      current: location === '/analytics',
    },
  ];

  const adminItems = [
    {
      title: t('nav.users'),
      href: '/users',
      icon: Users,
      current: location === '/users',
    },
    {
      title: t('nav.settings'),
      href: '/settings',
      icon: Settings,
      current: location === '/settings',
    },
  ];

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center justify-center p-6 border-b border-slate-200">
        <div className="flex items-center space-x-2">
          <Shield className="h-8 w-8 text-teal-600" />
          <span className="text-xl font-bold text-slate-800">AMBERSAND</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <a
                className={cn(
                  "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                  item.current
                    ? "bg-teal-50 text-teal-600 border border-teal-200"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <Icon className={cn("w-5 h-5", isRTL ? "ml-3" : "mr-3")} />
                <span>{item.title}</span>
              </a>
            </Link>
          );
        })}

        <Separator className="my-6" />
        
        <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Administration
        </p>

        {adminItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <a
                className={cn(
                  "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                  item.current
                    ? "bg-teal-50 text-teal-600 border border-teal-200"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <Icon className={cn("w-5 h-5", isRTL ? "ml-3" : "mr-3")} />
                <span>{item.title}</span>
              </a>
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center">
          <Avatar className="w-10 h-10">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback>
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className={cn("flex-1", isRTL ? "mr-3" : "ml-3")}>
            <p className="text-sm font-medium text-slate-800">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={cn("flex min-h-screen", isRTL && "rtl")}>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:left-0 lg:top-0 lg:z-40 lg:h-screen lg:w-64 lg:block">
        <div className="h-full bg-white shadow-lg border-r border-slate-200">
          <SidebarContent />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {/* Mobile Menu */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side={isRTL ? "right" : "left"} className="w-64 p-0">
                  <SidebarContent />
                </SheetContent>
              </Sheet>

              <h1 className="text-2xl font-bold text-slate-800 ml-4 lg:ml-0">
                {t('dashboard.title')}
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  type="search"
                  placeholder={t('actions.search')}
                  className="pl-10 w-64"
                />
              </div>

              {/* Language Toggle */}
              <Button variant="ghost" onClick={toggleLanguage} className="text-sm">
                <Globe className="h-4 w-4 mr-2" />
                {language === 'en' ? 'العربية' : 'English'}
              </Button>

              {/* Notifications */}
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {notificationCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                  >
                    {notificationCount}
                  </Badge>
                )}
              </Button>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2 text-sm">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={user?.profileImageUrl || undefined} />
                      <AvatarFallback>
                        {user?.firstName?.[0]}{user?.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span>{user?.firstName} {user?.lastName}</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/profile">
                      <a className="w-full">
                        {language === 'ar' ? 'الملف الشخصي' : 'Profile'}
                      </a>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href="/api/logout">
                      {t('actions.logout')}
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
