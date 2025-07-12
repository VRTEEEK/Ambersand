import { useI18n } from "@/hooks/use-i18n";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Globe, Bell, Shield, Database, Users, Mail } from 'lucide-react';

export default function Settings() {
  const { language, setLanguage } = useI18n();
  const { toast } = useToast();

  const handleSave = () => {
    toast({
      title: language === 'ar' ? 'تم حفظ الإعدادات' : 'Settings Saved',
      description: language === 'ar' ? 'تم تطبيق الإعدادات بنجاح' : 'Settings have been applied successfully',
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <SettingsIcon className="h-8 w-8" />
              {language === 'ar' ? 'الإعدادات' : 'Settings'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {language === 'ar' ? 'إدارة إعدادات النظام والحساب' : 'Manage system and account settings'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* General Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                {language === 'ar' ? 'الإعدادات العامة' : 'General Settings'}
              </CardTitle>
              <CardDescription>
                {language === 'ar' ? 'إعدادات اللغة والمظهر' : 'Language and appearance settings'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="language">
                  {language === 'ar' ? 'اللغة' : 'Language'}
                </Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ar">العربية</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="theme">
                  {language === 'ar' ? 'المظهر' : 'Theme'}
                </Label>
                <Select defaultValue="light">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      {language === 'ar' ? 'فاتح' : 'Light'}
                    </SelectItem>
                    <SelectItem value="dark">
                      {language === 'ar' ? 'داكن' : 'Dark'}
                    </SelectItem>
                    <SelectItem value="system">
                      {language === 'ar' ? 'حسب النظام' : 'System'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">
                  {language === 'ar' ? 'المنطقة الزمنية' : 'Timezone'}
                </Label>
                <Select defaultValue="asia/riyadh">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asia/riyadh">
                      {language === 'ar' ? 'الرياض (GMT+3)' : 'Riyadh (GMT+3)'}
                    </SelectItem>
                    <SelectItem value="utc">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                {language === 'ar' ? 'إعدادات الإشعارات' : 'Notification Settings'}
              </CardTitle>
              <CardDescription>
                {language === 'ar' ? 'إدارة تفضيلات الإشعارات' : 'Manage notification preferences'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">
                    {language === 'ar' ? 'إشعارات البريد الإلكتروني' : 'Email Notifications'}
                  </Label>
                  <p className="text-xs text-gray-500">
                    {language === 'ar' ? 'تلقي إشعارات المهام والمشاريع' : 'Receive task and project notifications'}
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">
                    {language === 'ar' ? 'إشعارات المواعيد النهائية' : 'Deadline Notifications'}
                  </Label>
                  <p className="text-xs text-gray-500">
                    {language === 'ar' ? 'تذكير بالمواعيد النهائية' : 'Reminders for upcoming deadlines'}
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">
                    {language === 'ar' ? 'إشعارات الامتثال' : 'Compliance Alerts'}
                  </Label>
                  <p className="text-xs text-gray-500">
                    {language === 'ar' ? 'تنبيهات حول حالة الامتثال' : 'Alerts about compliance status'}
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">
                    {language === 'ar' ? 'إشعارات المراجعة' : 'Review Notifications'}
                  </Label>
                  <p className="text-xs text-gray-500">
                    {language === 'ar' ? 'طلبات المراجعة والموافقة' : 'Review and approval requests'}
                  </p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {language === 'ar' ? 'إعدادات الأمان' : 'Security Settings'}
              </CardTitle>
              <CardDescription>
                {language === 'ar' ? 'إعدادات الأمان والخصوصية' : 'Security and privacy settings'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">
                    {language === 'ar' ? 'المصادقة الثنائية' : 'Two-Factor Authentication'}
                  </Label>
                  <p className="text-xs text-gray-500">
                    {language === 'ar' ? 'تأمين إضافي للحساب' : 'Additional account security'}
                  </p>
                </div>
                <Switch />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">
                    {language === 'ar' ? 'تسجيل الدخول التلقائي' : 'Auto Login'}
                  </Label>
                  <p className="text-xs text-gray-500">
                    {language === 'ar' ? 'البقاء متصلاً' : 'Stay logged in'}
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="session-timeout">
                  {language === 'ar' ? 'مهلة الجلسة (دقائق)' : 'Session Timeout (minutes)'}
                </Label>
                <Input
                  id="session-timeout"
                  type="number"
                  defaultValue="30"
                  min="5"
                  max="120"
                />
              </div>

              <Button variant="outline" size="sm" className="w-full">
                {language === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'}
              </Button>
            </CardContent>
          </Card>

          {/* Organization Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {language === 'ar' ? 'إعدادات المؤسسة' : 'Organization Settings'}
              </CardTitle>
              <CardDescription>
                {language === 'ar' ? 'إعدادات المؤسسة والفريق' : 'Organization and team settings'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">
                  {language === 'ar' ? 'اسم المؤسسة' : 'Organization Name'}
                </Label>
                <Input
                  id="org-name"
                  defaultValue="My Organization"
                  placeholder={language === 'ar' ? 'أدخل اسم المؤسسة' : 'Enter organization name'}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-email">
                  {language === 'ar' ? 'البريد الإلكتروني للتواصل' : 'Contact Email'}
                </Label>
                <Input
                  id="contact-email"
                  type="email"
                  defaultValue="contact@organization.com"
                  placeholder={language === 'ar' ? 'أدخل البريد الإلكتروني' : 'Enter contact email'}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="default-assignee">
                  {language === 'ar' ? 'المسؤول الافتراضي' : 'Default Assignee'}
                </Label>
                <Select defaultValue="admin">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      {language === 'ar' ? 'المشرف' : 'Admin'}
                    </SelectItem>
                    <SelectItem value="manager">
                      {language === 'ar' ? 'المدير' : 'Manager'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Data Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                {language === 'ar' ? 'إدارة البيانات' : 'Data Management'}
              </CardTitle>
              <CardDescription>
                {language === 'ar' ? 'إعدادات النسخ الاحتياطي والاستيراد' : 'Backup and import settings'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">
                    {language === 'ar' ? 'النسخ الاحتياطي التلقائي' : 'Automatic Backup'}
                  </Label>
                  <p className="text-xs text-gray-500">
                    {language === 'ar' ? 'نسخ احتياطي يومي للبيانات' : 'Daily data backup'}
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="retention-period">
                  {language === 'ar' ? 'فترة الاحتفاظ (أيام)' : 'Retention Period (days)'}
                </Label>
                <Input
                  id="retention-period"
                  type="number"
                  defaultValue="365"
                  min="30"
                  max="2555"
                />
              </div>

              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full">
                  {language === 'ar' ? 'تصدير البيانات' : 'Export Data'}
                </Button>
                <Button variant="outline" size="sm" className="w-full">
                  {language === 'ar' ? 'استيراد البيانات' : 'Import Data'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Integration Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                {language === 'ar' ? 'إعدادات التكامل' : 'Integration Settings'}
              </CardTitle>
              <CardDescription>
                {language === 'ar' ? 'التكامل مع الأنظمة الخارجية' : 'External system integrations'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="smtp-server">
                  {language === 'ar' ? 'خادم SMTP' : 'SMTP Server'}
                </Label>
                <Input
                  id="smtp-server"
                  placeholder={language === 'ar' ? 'mail.example.com' : 'mail.example.com'}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook-url">
                  {language === 'ar' ? 'رابط Webhook' : 'Webhook URL'}
                </Label>
                <Input
                  id="webhook-url"
                  placeholder={language === 'ar' ? 'https://api.example.com/webhook' : 'https://api.example.com/webhook'}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">
                    {language === 'ar' ? 'تفعيل API' : 'Enable API'}
                  </Label>
                  <p className="text-xs text-gray-500">
                    {language === 'ar' ? 'السماح بالوصول عبر API' : 'Allow API access'}
                  </p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} size="lg" className="px-8">
            {language === 'ar' ? 'حفظ الإعدادات' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}