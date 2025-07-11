import { useI18n } from "@/hooks/use-i18n";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Activity, Target, Users, Clock } from 'lucide-react';

const complianceData = [
  { month: 'Jan', compliance: 65, target: 80 },
  { month: 'Feb', compliance: 70, target: 80 },
  { month: 'Mar', compliance: 75, target: 80 },
  { month: 'Apr', compliance: 68, target: 80 },
  { month: 'May', compliance: 82, target: 80 },
  { month: 'Jun', compliance: 85, target: 80 },
];

const regulationData = [
  { name: 'ECC', value: 45, color: '#3b82f6' },
  { name: 'PDPL', value: 30, color: '#10b981' },
  { name: 'NDMO', value: 25, color: '#f59e0b' },
];

const taskStatusData = [
  { status: 'Completed', count: 45 },
  { status: 'In Progress', count: 23 },
  { status: 'Pending', count: 12 },
  { status: 'Overdue', count: 8 },
];

export default function Analytics() {
  const { language } = useI18n();

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {language === 'ar' ? 'التحليلات' : 'Analytics'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {language === 'ar' ? 'تحليل شامل لبيانات الامتثال والأداء' : 'Comprehensive compliance and performance analytics'}
            </p>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {language === 'ar' ? 'الامتثال الإجمالي' : 'Overall Compliance'}
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">85%</div>
              <p className="text-xs text-green-600">
                +5% {language === 'ar' ? 'من الشهر الماضي' : 'from last month'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {language === 'ar' ? 'المشاريع النشطة' : 'Active Projects'}
              </CardTitle>
              <Activity className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-blue-600">
                3 {language === 'ar' ? 'مشاريع جديدة' : 'new projects'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {language === 'ar' ? 'المهام المكتملة' : 'Completed Tasks'}
              </CardTitle>
              <Target className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">45</div>
              <p className="text-xs text-green-600">
                +12 {language === 'ar' ? 'هذا الأسبوع' : 'this week'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {language === 'ar' ? 'متوسط وقت الإنجاز' : 'Avg. Completion Time'}
              </CardTitle>
              <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">5.2</div>
              <p className="text-xs text-orange-600">
                {language === 'ar' ? 'أيام' : 'days'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Compliance Trend */}
          <Card>
            <CardHeader>
              <CardTitle>{language === 'ar' ? 'اتجاه الامتثال' : 'Compliance Trend'}</CardTitle>
              <CardDescription>
                {language === 'ar' ? 'تطور معدل الامتثال على مدى الأشهر الستة الماضية' : 'Compliance rate evolution over the past 6 months'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={complianceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="compliance" stroke="#3b82f6" strokeWidth={2} />
                  <Line type="monotone" dataKey="target" stroke="#eab308" strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Regulation Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>{language === 'ar' ? 'توزيع اللوائح' : 'Regulation Distribution'}</CardTitle>
              <CardDescription>
                {language === 'ar' ? 'توزيع المشاريع حسب نوع اللائحة' : 'Project distribution by regulation type'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={regulationData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {regulationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Task Status */}
          <Card>
            <CardHeader>
              <CardTitle>{language === 'ar' ? 'حالة المهام' : 'Task Status'}</CardTitle>
              <CardDescription>
                {language === 'ar' ? 'توزيع المهام حسب الحالة' : 'Task distribution by status'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={taskStatusData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="status" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Performance Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>{language === 'ar' ? 'مقاييس الأداء' : 'Performance Metrics'}</CardTitle>
              <CardDescription>
                {language === 'ar' ? 'المقاييس الرئيسية للأداء' : 'Key performance indicators'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {language === 'ar' ? 'معدل الإنجاز في الوقت المحدد' : 'On-time Completion Rate'}
                  </span>
                  <span className="text-sm font-bold text-green-600">92%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: '92%' }}></div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {language === 'ar' ? 'معدل جودة الأدلة' : 'Evidence Quality Score'}
                  </span>
                  <span className="text-sm font-bold text-blue-600">88%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '88%' }}></div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {language === 'ar' ? 'مشاركة الفريق' : 'Team Engagement'}
                  </span>
                  <span className="text-sm font-bold text-purple-600">75%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-purple-600 h-2 rounded-full" style={{ width: '75%' }}></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}