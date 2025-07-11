import { useState, useEffect } from 'react';

export type Language = 'en' | 'ar';

interface TranslationStrings {
  // Navigation
  'nav.dashboard': string;
  'nav.regulations': string;
  'nav.projects': string;
  'nav.tasks': string;
  'nav.evidence': string;
  'nav.analytics': string;
  'nav.users': string;
  'nav.settings': string;
  
  // Dashboard
  'dashboard.title': string;
  'dashboard.overallCompliance': string;
  'dashboard.activeProjects': string;
  'dashboard.pendingTasks': string;
  'dashboard.regulations': string;
  'dashboard.complianceTrend': string;
  'dashboard.regulationStatus': string;
  'dashboard.recentProjects': string;
  'dashboard.upcomingTasks': string;
  'dashboard.quickActions': string;
  
  // Actions
  'actions.createProject': string;
  'actions.addTask': string;
  'actions.uploadEvidence': string;
  'actions.generateReport': string;
  'actions.viewAll': string;
  'actions.search': string;
  'actions.login': string;
  'actions.logout': string;
  
  // Status
  'status.onTrack': string;
  'status.overdue': string;
  'status.planning': string;
  'status.active': string;
  'status.completed': string;
  'status.high': string;
  'status.medium': string;
  'status.low': string;
  'status.urgent': string;
  
  // Common
  'common.loading': string;
  'common.error': string;
  'common.success': string;
  'common.cancel': string;
  'common.save': string;
  'common.delete': string;
  'common.edit': string;
  'common.create': string;
  'common.update': string;
  'common.lastUpdated': string;
  'common.assignedTo': string;
  'common.dueDate': string;
  'common.progress': string;
  'common.description': string;
  'common.title': string;
  'common.name': string;
  'common.email': string;
  'common.role': string;
  'common.date': string;
  'common.status': string;
  'common.priority': string;
  'common.type': string;
  'common.file': string;
  'common.upload': string;
  'common.download': string;
}

const translations: Record<Language, TranslationStrings> = {
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.regulations': 'Regulation Library',
    'nav.projects': 'Projects',
    'nav.tasks': 'Task Management',
    'nav.evidence': 'Evidence Repository',
    'nav.analytics': 'Analytics & Reports',
    'nav.users': 'User Management',
    'nav.settings': 'Settings',
    
    // Dashboard
    'dashboard.title': 'Compliance Dashboard',
    'dashboard.overallCompliance': 'Overall Compliance',
    'dashboard.activeProjects': 'Active Projects',
    'dashboard.pendingTasks': 'Pending Tasks',
    'dashboard.regulations': 'Regulations',
    'dashboard.complianceTrend': 'Compliance Trend',
    'dashboard.regulationStatus': 'Regulation Status',
    'dashboard.recentProjects': 'Recent Projects',
    'dashboard.upcomingTasks': 'Upcoming Tasks',
    'dashboard.quickActions': 'Quick Actions',
    
    // Actions
    'actions.createProject': 'Create Project',
    'actions.addTask': 'Add Task',
    'actions.uploadEvidence': 'Upload Evidence',
    'actions.generateReport': 'Generate Report',
    'actions.viewAll': 'View all',
    'actions.search': 'Search...',
    'actions.login': 'Login',
    'actions.logout': 'Logout',
    
    // Status
    'status.onTrack': 'On Track',
    'status.overdue': 'Overdue',
    'status.planning': 'Planning',
    'status.active': 'Active',
    'status.completed': 'Completed',
    'status.high': 'High',
    'status.medium': 'Medium',
    'status.low': 'Low',
    'status.urgent': 'Urgent',
    
    // Common
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.create': 'Create',
    'common.update': 'Update',
    'common.lastUpdated': 'Last updated',
    'common.assignedTo': 'Assigned to',
    'common.dueDate': 'Due date',
    'common.progress': 'Progress',
    'common.description': 'Description',
    'common.title': 'Title',
    'common.name': 'Name',
    'common.email': 'Email',
    'common.role': 'Role',
    'common.date': 'Date',
    'common.status': 'Status',
    'common.priority': 'Priority',
    'common.type': 'Type',
    'common.file': 'File',
    'common.upload': 'Upload',
    'common.download': 'Download',
  },
  ar: {
    // Navigation
    'nav.dashboard': 'لوحة القيادة',
    'nav.regulations': 'مكتبة اللوائح',
    'nav.projects': 'المشاريع',
    'nav.tasks': 'إدارة المهام',
    'nav.evidence': 'مستودع الأدلة',
    'nav.analytics': 'التحليلات والتقارير',
    'nav.users': 'إدارة المستخدمين',
    'nav.settings': 'الإعدادات',
    
    // Dashboard
    'dashboard.title': 'لوحة قيادة الامتثال',
    'dashboard.overallCompliance': 'الامتثال العام',
    'dashboard.activeProjects': 'المشاريع النشطة',
    'dashboard.pendingTasks': 'المهام المعلقة',
    'dashboard.regulations': 'اللوائح',
    'dashboard.complianceTrend': 'اتجاه الامتثال',
    'dashboard.regulationStatus': 'حالة اللوائح',
    'dashboard.recentProjects': 'المشاريع الأخيرة',
    'dashboard.upcomingTasks': 'المهام القادمة',
    'dashboard.quickActions': 'الإجراءات السريعة',
    
    // Actions
    'actions.createProject': 'إنشاء مشروع',
    'actions.addTask': 'إضافة مهمة',
    'actions.uploadEvidence': 'رفع دليل',
    'actions.generateReport': 'إنشاء تقرير',
    'actions.viewAll': 'عرض الكل',
    'actions.search': 'البحث...',
    'actions.login': 'تسجيل الدخول',
    'actions.logout': 'تسجيل الخروج',
    
    // Status
    'status.onTrack': 'في المسار',
    'status.overdue': 'متأخر',
    'status.planning': 'التخطيط',
    'status.active': 'نشط',
    'status.completed': 'مكتمل',
    'status.high': 'عالي',
    'status.medium': 'متوسط',
    'status.low': 'منخفض',
    'status.urgent': 'عاجل',
    
    // Common
    'common.loading': 'جاري التحميل...',
    'common.error': 'خطأ',
    'common.success': 'نجح',
    'common.cancel': 'إلغاء',
    'common.save': 'حفظ',
    'common.delete': 'حذف',
    'common.edit': 'تعديل',
    'common.create': 'إنشاء',
    'common.update': 'تحديث',
    'common.lastUpdated': 'آخر تحديث',
    'common.assignedTo': 'مُكلف إلى',
    'common.dueDate': 'تاريخ الاستحقاق',
    'common.progress': 'التقدم',
    'common.description': 'الوصف',
    'common.title': 'العنوان',
    'common.name': 'الاسم',
    'common.email': 'البريد الإلكتروني',
    'common.role': 'الدور',
    'common.date': 'التاريخ',
    'common.status': 'الحالة',
    'common.priority': 'الأولوية',
    'common.type': 'النوع',
    'common.file': 'الملف',
    'common.upload': 'رفع',
    'common.download': 'تحميل',
  },
};

export function useI18n() {
  const [language, setLanguage] = useState<Language>('en');

  useEffect(() => {
    // Update document direction and lang attribute
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    
    // Store language preference
    localStorage.setItem('language', language);
  }, [language]);

  useEffect(() => {
    // Load saved language preference
    const savedLanguage = localStorage.getItem('language') as Language;
    if (savedLanguage && ['en', 'ar'].includes(savedLanguage)) {
      setLanguage(savedLanguage);
    }
  }, []);

  const t = (key: keyof TranslationStrings): string => {
    return translations[language][key] || key;
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'ar' : 'en');
  };

  return {
    language,
    setLanguage,
    toggleLanguage,
    t,
    isRTL: language === 'ar',
  };
}
