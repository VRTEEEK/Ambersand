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
  Save,
  Camera,
  Upload
} from 'lucide-react';
import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';

export default function UserProfile() {
  const { language } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  
  // Form refs
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const jobTitleRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch user statistics
  const { data: stats, isLoading: statsLoading } = useQuery<{projectCount: number, taskCount: number}>({
    queryKey: ['/api/users', user?.id, 'stats'],
    queryFn: async () => {
      const response = await fetch(`/api/users/${user?.id}/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    enabled: !!user?.id,
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = localStorage.getItem('accessToken');
      console.log('[Profile Update Frontend] Making API call to:', `/api/users/${user?.id}`);
      console.log('[Profile Update Frontend] Request body:', JSON.stringify(data));

      const response = await fetch(`/api/users/${user?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      console.log('[Profile Update Frontend] Response status:', response.status);

      if (!response.ok) {
        const error = await response.json();
        console.log('[Profile Update Frontend] Error response:', error);
        throw new Error(error.message || 'Failed to update profile');
      }

      const result = await response.json();
      console.log('[Profile Update Frontend] Success response:', result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users', user?.id, 'stats'] });
      toast({
        title: language === 'ar' ? 'تم حفظ الملف الشخصي' : 'Profile Saved',
        description: language === 'ar' ? 'تم تحديث معلومات الملف الشخصي بنجاح' : 'Profile information updated successfully',
      });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message || (language === 'ar' ? 'فشل في تحديث الملف الشخصي' : 'Failed to update profile'),
        variant: 'destructive',
      });
    },
  });

  // Upload profile image mutation with token refresh support
  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);

      let token = localStorage.getItem('accessToken');
      let response = await fetch(`/api/users/${user?.id}/profile-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      // If we get a 401, try to refresh the token and retry
      if (response.status === 401) {
        console.log('[Profile Image Upload] Got 401, attempting token refresh');
        const refreshToken = localStorage.getItem('refreshToken');

        if (refreshToken) {
          try {
            const refreshResponse = await fetch('/api/auth/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken }),
            });

            if (refreshResponse.ok) {
              console.log('[Profile Image Upload] Token refreshed successfully');
              const refreshData = await refreshResponse.json();
              const newAccessToken = refreshData.data.accessToken;
              const newRefreshToken = refreshData.data.refreshToken;

              localStorage.setItem('accessToken', newAccessToken);
              localStorage.setItem('refreshToken', newRefreshToken);

              // Retry the upload with new token
              response = await fetch(`/api/users/${user?.id}/profile-image`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${newAccessToken}`,
                },
                body: formData,
              });
            } else {
              console.log('[Profile Image Upload] Token refresh failed, redirecting to login');
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              window.location.href = '/auth/login';
              throw new Error('Session expired, please login again');
            }
          } catch (error) {
            console.error('[Profile Image Upload] Error during token refresh:', error);
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            window.location.href = '/auth/login';
            throw error;
          }
        } else {
          console.log('[Profile Image Upload] No refresh token available');
          localStorage.removeItem('accessToken');
          window.location.href = '/auth/login';
          throw new Error('Session expired, please login again');
        }
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload image');
      }

      return response.json();
    },
    onSuccess: (data) => {
      console.log('[Profile Image Upload] Upload successful, response:', data);
      console.log('[Profile Image Upload] Invalidating cache for user:', user?.id);

      queryClient.invalidateQueries({ queryKey: ['/api/users', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users', user?.id, 'stats'] });

      console.log('[Profile Image Upload] Cache invalidated, user should refetch');

      toast({
        title: language === 'ar' ? 'تم تحميل الصورة' : 'Image Uploaded',
        description: language === 'ar' ? 'تم تحديث صورة الملف الشخصي بنجاح' : 'Profile image updated successfully',
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: (error: any) => {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message || (language === 'ar' ? 'فشل في تحميل الصورة' : 'Failed to upload image'),
        variant: 'destructive',
      });
    },
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'يرجى اختيار صورة صالحة' : 'Please select a valid image file',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'حجم الصورة يجب أن يكون أقل من 5 ميجابايت' : 'Image size must be less than 5MB',
        variant: 'destructive',
      });
      return;
    }

    uploadImageMutation.mutate(file);
  };

  const handleSave = () => {
    // Get values and trim whitespace
    const firstName = firstNameRef.current?.value?.trim() || '';
    const lastName = lastNameRef.current?.value?.trim() || '';
    const email = emailRef.current?.value?.trim() || '';
    const phone = phoneRef.current?.value?.trim() || '';
    const jobTitle = jobTitleRef.current?.value?.trim() || '';

    // Validate mandatory fields
    if (!firstName) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'الاسم الأول مطلوب' : 'First name is required',
        variant: 'destructive',
      });
      return;
    }

    if (!lastName) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'الاسم الأخير مطلوب' : 'Last name is required',
        variant: 'destructive',
      });
      return;
    }

    if (!email) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'البريد الإلكتروني مطلوب' : 'Email is required',
        variant: 'destructive',
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'يرجى إدخال بريد إلكتروني صالح' : 'Please enter a valid email',
        variant: 'destructive',
      });
      return;
    }

    // Phone number validation (if provided)
    if (phone) {
      const phoneRegex = /^[0-9+\-\s()]*$/;
      if (!phoneRegex.test(phone)) {
        toast({
          title: language === 'ar' ? 'خطأ' : 'Error',
          description: language === 'ar' ? 'رقم الهاتف يجب أن يحتوي على أرقام فقط' : 'Phone number can only contain numbers, +, -, spaces, and parentheses',
          variant: 'destructive',
        });
        return;
      }
    }

    const updateData = {
      firstName,
      lastName,
      email,
      phone,
      jobTitle,
    };

    console.log('[Profile Update Frontend] User ID:', user?.id);
    console.log('[Profile Update Frontend] Update data:', updateData);

    updateProfileMutation.mutate(updateData);
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
              <div className="flex justify-center mb-4 relative">
                <div className="relative group">
                  <UserAvatar user={user} size="lg" className="h-24 w-24" />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadImageMutation.isPending}
                    className="absolute bottom-0 right-0 bg-[#2699A6] hover:bg-[#1e7a85] text-white p-2 rounded-full shadow-lg transition-all transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={language === 'ar' ? 'تحميل صورة' : 'Upload image'}
                    data-testid="button-upload-profile-image"
                  >
                    {uploadImageMutation.isPending ? (
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                    data-testid="input-profile-image"
                  />
                </div>
              </div>
              <CardTitle className="text-xl">
                {user?.firstName || user?.lastName 
                  ? `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
                  : language === 'ar' ? 'المستخدم' : 'User'
                }
              </CardTitle>
              <CardDescription>
                {user?.email || (language === 'ar' ? 'لا يوجد بريد إلكتروني' : 'No email available')}
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
                  <div className="text-center" data-testid="profile-project-count">
                    <div className="font-bold text-blue-600">
                      {statsLoading ? '...' : stats?.projectCount ?? 0}
                    </div>
                    <div className="text-gray-500">
                      {language === 'ar' ? 'مشاريع' : 'Projects'}
                    </div>
                  </div>
                  <div className="text-center" data-testid="profile-task-count">
                    <div className="font-bold text-green-600">
                      {statsLoading ? '...' : stats?.taskCount ?? 0}
                    </div>
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
                  <Label htmlFor="firstName" className="flex items-center gap-1">
                    {language === 'ar' ? 'الاسم الأول' : 'First Name'}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    ref={firstNameRef}
                    id="firstName"
                    data-testid="input-first-name"
                    defaultValue={user?.firstName || ''}
                    disabled={!isEditing}
                    placeholder={language === 'ar' ? 'أدخل الاسم الأول' : 'Enter first name'}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="flex items-center gap-1">
                    {language === 'ar' ? 'الاسم الأخير' : 'Last Name'}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    ref={lastNameRef}
                    id="lastName"
                    data-testid="input-last-name"
                    defaultValue={user?.lastName || ''}
                    disabled={!isEditing}
                    placeholder={language === 'ar' ? 'أدخل الاسم الأخير' : 'Enter last name'}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-1">
                  {language === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
                  <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    ref={emailRef}
                    id="email"
                    type="email"
                    data-testid="input-email"
                    defaultValue={user?.email || ''}
                    disabled={!isEditing}
                    className="pl-10"
                    placeholder={language === 'ar' ? 'أدخل البريد الإلكتروني' : 'Enter email address'}
                    required
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
                    ref={phoneRef}
                    id="phone"
                    data-testid="input-phone"
                    type="tel"
                    defaultValue={user?.phone || ''}
                    disabled={!isEditing}
                    className="pl-10"
                    placeholder={language === 'ar' ? '+966 XX XXX XXXX' : '+1 (555) 123-4567'}
                    onInput={(e) => {
                      const input = e.target as HTMLInputElement;
                      const value = input.value;
                      const filtered = value.replace(/[^0-9+\-\s()]/g, '');
                      if (value !== filtered) {
                        input.value = filtered;
                      }
                    }}
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
                    ref={jobTitleRef}
                    id="jobTitle"
                    data-testid="input-job-title"
                    defaultValue={user?.jobTitle || ''}
                    disabled={!isEditing}
                    className="pl-10"
                    placeholder={language === 'ar' ? 'أدخل المسمى الوظيفي' : 'Enter job title'}
                  />
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
              data-testid="button-cancel"
            >
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button 
              onClick={handleSave}
              disabled={updateProfileMutation.isPending}
              data-testid="button-save-changes"
            >
              {updateProfileMutation.isPending 
                ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') 
                : (language === 'ar' ? 'حفظ التغييرات' : 'Save Changes')
              }
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}