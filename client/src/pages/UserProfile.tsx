import { useI18n } from "@/hooks/use-i18n";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  User, 
  Mail, 
  Calendar, 
  MapPin, 
  Phone, 
  Briefcase, 
  Award, 
  Clock,
  Edit3,
  Save
} from 'lucide-react';
import { useState } from 'react';

export default function UserProfile() {
  const { language } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    toast({
      title: language === 'ar' ? 'تم حفظ الملف الشخصي' : 'Profile Saved',
      description: language === 'ar' ? 'تم تحديث معلومات الملف الشخصي بنجاح' : 'Profile information updated successfully',
    });
    setIsEditing(false);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <User className="h-8 w-8" />
              {language === 'ar' ? 'الملف الشخصي' : 'User Profile'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {language === 'ar' ? 'إدارة معلومات الملف الشخصي والإعدادات' : 'Manage your profile information and settings'}
            </p>
          </div>
          <Button
            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
            variant={isEditing ? "default" : "outline"}
            size="lg"
          >
            {isEditing ? (
              <>
                <Save className="h-4 w-4 mr-2" />
                {language === 'ar' ? 'حفظ' : 'Save'}
              </>
            ) : (
              <>
                <Edit3 className="h-4 w-4 mr-2" />
                {language === 'ar' ? 'تعديل' : 'Edit'}
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Overview */}
          <Card className="lg:col-span-1">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <UserAvatar user={user} size="2xl" className="h-24 w-24" />
              </div>
              <CardTitle className="text-xl">
                {user?.firstName || user?.lastName 
                  ? `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
                  : language === 'ar' ? 'المستخدم' : 'User'
                }
              </CardTitle>
              <CardDescription>
                {user?.email || language === 'ar' ? 'لا يوجد بريد إلكتروني' : 'No email available'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {language === 'ar' ? 'مدير امتثال' : 'Compliance Manager'}
                </Badge>
              </div>
              
              <Separator />
              
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600 dark:text-gray-400">
                    {language === 'ar' ? 'تاريخ الانضمام:' : 'Joined:'} 
                  </span>
                  <span>
                    {user?.createdAt 
                      ? new Date(user.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')
                      : language === 'ar' ? 'غير محدد' : 'Not specified'
                    }
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600 dark:text-gray-400">
                    {language === 'ar' ? 'آخر تحديث:' : 'Last updated:'} 
                  </span>
                  <span>
                    {user?.updatedAt 
                      ? new Date(user.updatedAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')
                      : language === 'ar' ? 'غير محدد' : 'Not specified'
                    }
                  </span>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">
                  {language === 'ar' ? 'الإحصائيات' : 'Statistics'}
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-bold text-blue-600">12</div>
                    <div className="text-gray-500">
                      {language === 'ar' ? 'مشاريع' : 'Projects'}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-green-600">45</div>
                    <div className="text-gray-500">
                      {language === 'ar' ? 'مهام' : 'Tasks'}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personal Information */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {language === 'ar' ? 'المعلومات الشخصية' : 'Personal Information'}
              </CardTitle>
              <CardDescription>
                {language === 'ar' ? 'معلومات الملف الشخصي والتواصل' : 'Profile and contact information'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">
                    {language === 'ar' ? 'الاسم الأول' : 'First Name'}
                  </Label>
                  <Input
                    id="firstName"
                    defaultValue={user?.firstName || ''}
                    disabled={!isEditing}
                    placeholder={language === 'ar' ? 'أدخل الاسم الأول' : 'Enter first name'}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="lastName">
                    {language === 'ar' ? 'الاسم الأخير' : 'Last Name'}
                  </Label>
                  <Input
                    id="lastName"
                    defaultValue={user?.lastName || ''}
                    disabled={!isEditing}
                    placeholder={language === 'ar' ? 'أدخل الاسم الأخير' : 'Enter last name'}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  {language === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    defaultValue={user?.email || ''}
                    disabled={!isEditing}
                    className="pl-10"
                    placeholder={language === 'ar' ? 'أدخل البريد الإلكتروني' : 'Enter email address'}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">
                  {language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="phone"
                    type="tel"
                    disabled={!isEditing}
                    className="pl-10"
                    placeholder={language === 'ar' ? 'أدخل رقم الهاتف' : 'Enter phone number'}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">
                  {language === 'ar' ? 'الموقع' : 'Location'}
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="location"
                    disabled={!isEditing}
                    className="pl-10"
                    placeholder={language === 'ar' ? 'أدخل الموقع' : 'Enter location'}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="jobTitle">
                  {language === 'ar' ? 'المسمى الوظيفي' : 'Job Title'}
                </Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="jobTitle"
                    disabled={!isEditing}
                    className="pl-10"
                    placeholder={language === 'ar' ? 'أدخل المسمى الوظيفي' : 'Enter job title'}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">
                  {language === 'ar' ? 'نبذة شخصية' : 'Bio'}
                </Label>
                <Textarea
                  id="bio"
                  disabled={!isEditing}
                  rows={4}
                  placeholder={language === 'ar' ? 'أدخل نبذة شخصية' : 'Enter bio'}
                />
              </div>
            </CardContent>
          </Card>

          {/* Professional Information */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                {language === 'ar' ? 'المعلومات المهنية' : 'Professional Information'}
              </CardTitle>
              <CardDescription>
                {language === 'ar' ? 'المؤهلات والخبرات المهنية' : 'Professional qualifications and experience'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="department">
                      {language === 'ar' ? 'القسم' : 'Department'}
                    </Label>
                    <Input
                      id="department"
                      disabled={!isEditing}
                      placeholder={language === 'ar' ? 'أدخل القسم' : 'Enter department'}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="manager">
                      {language === 'ar' ? 'المدير المباشر' : 'Direct Manager'}
                    </Label>
                    <Input
                      id="manager"
                      disabled={!isEditing}
                      placeholder={language === 'ar' ? 'أدخل اسم المدير المباشر' : 'Enter direct manager name'}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="employeeId">
                      {language === 'ar' ? 'رقم الموظف' : 'Employee ID'}
                    </Label>
                    <Input
                      id="employeeId"
                      disabled={!isEditing}
                      placeholder={language === 'ar' ? 'أدخل رقم الموظف' : 'Enter employee ID'}
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="experience">
                      {language === 'ar' ? 'سنوات الخبرة' : 'Years of Experience'}
                    </Label>
                    <Input
                      id="experience"
                      type="number"
                      disabled={!isEditing}
                      placeholder={language === 'ar' ? 'أدخل سنوات الخبرة' : 'Enter years of experience'}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="certifications">
                      {language === 'ar' ? 'الشهادات' : 'Certifications'}
                    </Label>
                    <Textarea
                      id="certifications"
                      disabled={!isEditing}
                      rows={3}
                      placeholder={language === 'ar' ? 'أدخل الشهادات والمؤهلات' : 'Enter certifications and qualifications'}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        {isEditing && (
          <div className="flex justify-end gap-4">
            <Button
              variant="outline"
              onClick={() => setIsEditing(false)}
            >
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleSave}>
              {language === 'ar' ? 'حفظ التغييرات' : 'Save Changes'}
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}