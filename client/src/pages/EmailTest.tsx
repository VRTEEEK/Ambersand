import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { useI18n } from '@/hooks/use-i18n';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Mail, Send, TestTube } from 'lucide-react';

export default function EmailTest() {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [emailType, setEmailType] = useState('');

  const sendTestEmailMutation = useMutation({
    mutationFn: async (data: { to: string; type: string }) => {
      return await apiRequest('/api/test-email', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: language === 'ar' ? 'تم الإرسال بنجاح' : 'Email Sent Successfully',
        description: language === 'ar' ? 'تم إرسال رسالة الاختبار بنجاح' : 'Test email has been sent successfully',
      });
      setEmail('');
      setEmailType('');
    },
    onError: (error: any) => {
      toast({
        title: language === 'ar' ? 'فشل في الإرسال' : 'Failed to Send Email',
        description: error.message || (language === 'ar' ? 'حدث خطأ أثناء إرسال البريد الإلكتروني' : 'An error occurred while sending the email'),
        variant: 'destructive',
      });
    },
  });

  const handleSendTestEmail = () => {
    if (!email || !emailType) {
      toast({
        title: language === 'ar' ? 'بيانات مطلوبة' : 'Required Fields',
        description: language === 'ar' ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields',
        variant: 'destructive',
      });
      return;
    }

    sendTestEmailMutation.mutate({ to: email, type: emailType });
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-teal-100 rounded-lg">
                  <TestTube className="w-6 h-6 text-teal-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    {language === 'ar' ? 'اختبار البريد الإلكتروني' : 'Email Testing'}
                  </h1>
                  <p className="text-gray-600 mt-1">
                    {language === 'ar' 
                      ? 'اختبر قوالب البريد الإلكتروني للتأكد من عملها بشكل صحيح'
                      : 'Test email templates to ensure they work properly'
                    }
                  </p>
                </div>
              </div>
            </div>

            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-teal-600" />
                  {language === 'ar' ? 'إرسال رسالة اختبار' : 'Send Test Email'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email">
                    {language === 'ar' ? 'البريد الإلكتروني للمستلم' : 'Recipient Email'}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={language === 'ar' ? 'أدخل البريد الإلكتروني' : 'Enter email address'}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emailType">
                    {language === 'ar' ? 'نوع الرسالة' : 'Email Type'}
                  </Label>
                  <Select value={emailType} onValueChange={setEmailType}>
                    <SelectTrigger>
                      <SelectValue placeholder={language === 'ar' ? 'اختر نوع الرسالة' : 'Select email type'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="task-assignment">
                        {language === 'ar' ? 'إسناد مهمة' : 'Task Assignment'}
                      </SelectItem>
                      <SelectItem value="deadline-reminder">
                        {language === 'ar' ? 'تذكير بالموعد النهائي' : 'Deadline Reminder'}
                      </SelectItem>
                      <SelectItem value="status-update">
                        {language === 'ar' ? 'تحديث الحالة' : 'Status Update'}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={handleSendTestEmail}
                  disabled={sendTestEmailMutation.isPending || !email || !emailType}
                  className="w-full bg-teal-600 hover:bg-teal-700"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {sendTestEmailMutation.isPending 
                    ? (language === 'ar' ? 'جاري الإرسال...' : 'Sending...') 
                    : (language === 'ar' ? 'إرسال رسالة اختبار' : 'Send Test Email')
                  }
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {language === 'ar' ? 'معلومات حول قوالب البريد الإلكتروني' : 'Email Template Information'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">
                      {language === 'ar' ? 'إسناد مهمة' : 'Task Assignment'}
                    </h4>
                    <p className="text-gray-600">
                      {language === 'ar' 
                        ? 'يتم إرسالها عند إسناد مهمة جديدة للمستخدم'
                        : 'Sent when a new task is assigned to a user'
                      }
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">
                      {language === 'ar' ? 'تذكير بالموعد النهائي' : 'Deadline Reminder'}
                    </h4>
                    <p className="text-gray-600">
                      {language === 'ar' 
                        ? 'يتم إرسالها للتذكير بقرب انتهاء موعد المهمة'
                        : 'Sent to remind users of upcoming task deadlines'
                      }
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">
                      {language === 'ar' ? 'تحديث الحالة' : 'Status Update'}
                    </h4>
                    <p className="text-gray-600">
                      {language === 'ar' 
                        ? 'يتم إرسالها عند تحديث حالة المهمة'
                        : 'Sent when task status is updated'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}