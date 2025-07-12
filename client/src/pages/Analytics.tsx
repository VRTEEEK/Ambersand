import { useI18n } from "@/hooks/use-i18n";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Activity, Target, Users, Clock, BarChart3, PieChart as PieChartIcon, LineChart as LineChartIcon, Zap } from 'lucide-react';
import heroBackgroundPath from "@assets/image_1752308830644.png";

const complianceData = [
  { month: 'Jan', compliance: 65, target: 80 },
  { month: 'Feb', compliance: 70, target: 80 },
  { month: 'Mar', compliance: 75, target: 80 },
  { month: 'Apr', compliance: 68, target: 80 },
  { month: 'May', compliance: 82, target: 80 },
  { month: 'Jun', compliance: 85, target: 80 },
];

const regulationData = [
  { name: 'ECC', value: 45, color: '#2699A6' },
  { name: 'PDPL', value: 30, color: '#059669' },
  { name: 'NDMO', value: 25, color: '#d97706' },
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
      <div className="space-y-8">
        {/* Hero Section with Background */}
        <div 
          className="relative overflow-hidden rounded-2xl"
          style={{
            backgroundImage: `url(${heroBackgroundPath})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        >
          {/* Overlay for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-teal-600/90 via-teal-700/80 to-teal-800/90"></div>
          
          {/* Content */}
          <div className="relative px-8 py-16 md:py-20">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
              <div className="text-center lg:text-left">
                {/* Key Stats Overview */}
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 text-white/90">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <span className="font-semibold">85% {language === 'ar' ? 'امتثال' : 'Compliance'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                      <Activity className="h-4 w-4" />
                    </div>
                    <span className="font-semibold">12 {language === 'ar' ? 'مشروع نشط' : 'Active Projects'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                      <Target className="h-4 w-4" />
                    </div>
                    <span className="font-semibold">45 {language === 'ar' ? 'مهمة مكتملة' : 'Completed Tasks'}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-center lg:justify-end">
                <div className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm px-8 py-6 text-lg rounded-xl transition-all duration-200 hover:scale-105">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white mb-2">92%</div>
                    <div className="text-white/80 text-sm">
                      {language === 'ar' ? 'معدل الإنجاز في الوقت المحدد' : 'On-time Completion'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border border-slate-200/60 dark:border-slate-700/60 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 bg-white dark:bg-slate-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {language === 'ar' ? 'الامتثال الإجمالي' : 'Overall Compliance'}
              </CardTitle>
              <div className="w-8 h-8 bg-[#2699A6]/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-[#2699A6]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">85%</div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <p className="text-xs text-green-600 font-medium">
                  +5% {language === 'ar' ? 'من الشهر الماضي' : 'from last month'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/60 dark:border-slate-700/60 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 bg-white dark:bg-slate-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {language === 'ar' ? 'المشاريع النشطة' : 'Active Projects'}
              </CardTitle>
              <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Activity className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">12</div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <p className="text-xs text-blue-600 font-medium">
                  3 {language === 'ar' ? 'مشاريع جديدة' : 'new projects'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/60 dark:border-slate-700/60 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 bg-white dark:bg-slate-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {language === 'ar' ? 'المهام المكتملة' : 'Completed Tasks'}
              </CardTitle>
              <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center">
                <Target className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">45</div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <p className="text-xs text-green-600 font-medium">
                  +12 {language === 'ar' ? 'هذا الأسبوع' : 'this week'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/60 dark:border-slate-700/60 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 bg-white dark:bg-slate-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {language === 'ar' ? 'متوسط وقت الإنجاز' : 'Avg. Completion Time'}
              </CardTitle>
              <div className="w-8 h-8 bg-orange-500/10 rounded-lg flex items-center justify-center">
                <Clock className="h-4 w-4 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">5.2</div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <p className="text-xs text-orange-600 font-medium">
                  {language === 'ar' ? 'أيام' : 'days'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Compliance Trend */}
          <Card className="border border-slate-200/60 dark:border-slate-700/60 shadow-xl backdrop-blur-sm bg-white dark:bg-slate-800">
            <CardHeader className="bg-gradient-to-r from-slate-50/80 to-white/80 dark:from-slate-800/80 dark:to-slate-900/80 rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#2699A6]/20 rounded-xl flex items-center justify-center">
                  <LineChartIcon className="h-5 w-5 text-[#2699A6]" />
                </div>
                <div>
                  <CardTitle className="text-xl text-slate-900 dark:text-white">
                    {language === 'ar' ? 'اتجاه الامتثال' : 'Compliance Trend'}
                  </CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400">
                    {language === 'ar' ? 'تطور معدل الامتثال على مدى الأشهر الستة الماضية' : 'Compliance rate evolution over the past 6 months'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={complianceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="compliance" stroke="#2699A6" strokeWidth={3} dot={{ fill: '#2699A6', strokeWidth: 2, r: 4 }} />
                  <Line type="monotone" dataKey="target" stroke="#f59e0b" strokeDasharray="5 5" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Regulation Distribution */}
          <Card className="border border-slate-200/60 dark:border-slate-700/60 shadow-xl backdrop-blur-sm bg-white dark:bg-slate-800">
            <CardHeader className="bg-gradient-to-r from-slate-50/80 to-white/80 dark:from-slate-800/80 dark:to-slate-900/80 rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#2699A6]/20 rounded-xl flex items-center justify-center">
                  <PieChartIcon className="h-5 w-5 text-[#2699A6]" />
                </div>
                <div>
                  <CardTitle className="text-xl text-slate-900 dark:text-white">
                    {language === 'ar' ? 'توزيع اللوائح' : 'Regulation Distribution'}
                  </CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400">
                    {language === 'ar' ? 'توزيع المشاريع حسب نوع اللائحة' : 'Project distribution by regulation type'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={regulationData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {regulationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Task Status */}
          <Card className="border border-slate-200/60 dark:border-slate-700/60 shadow-xl backdrop-blur-sm bg-white dark:bg-slate-800">
            <CardHeader className="bg-gradient-to-r from-slate-50/80 to-white/80 dark:from-slate-800/80 dark:to-slate-900/80 rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#2699A6]/20 rounded-xl flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-[#2699A6]" />
                </div>
                <div>
                  <CardTitle className="text-xl text-slate-900 dark:text-white">
                    {language === 'ar' ? 'حالة المهام' : 'Task Status'}
                  </CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400">
                    {language === 'ar' ? 'توزيع المهام حسب الحالة' : 'Task distribution by status'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={taskStatusData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="status" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Bar dataKey="count" fill="#2699A6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Performance Metrics */}
          <Card className="border border-slate-200/60 dark:border-slate-700/60 shadow-xl backdrop-blur-sm bg-white dark:bg-slate-800">
            <CardHeader className="bg-gradient-to-r from-slate-50/80 to-white/80 dark:from-slate-800/80 dark:to-slate-900/80 rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#2699A6]/20 rounded-xl flex items-center justify-center">
                  <Zap className="h-5 w-5 text-[#2699A6]" />
                </div>
                <div>
                  <CardTitle className="text-xl text-slate-900 dark:text-white">
                    {language === 'ar' ? 'مقاييس الأداء' : 'Performance Metrics'}
                  </CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400">
                    {language === 'ar' ? 'المقاييس الرئيسية للأداء' : 'Key performance indicators'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {language === 'ar' ? 'معدل الإنجاز في الوقت المحدد' : 'On-time Completion Rate'}
                    </span>
                    <Badge variant="secondary" className="bg-[#2699A6]/10 text-[#2699A6] border-[#2699A6]/20">
                      92%
                    </Badge>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                    <div className="bg-gradient-to-r from-[#2699A6] to-[#1e7a85] h-3 rounded-full transition-all duration-300" style={{ width: '92%' }}></div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {language === 'ar' ? 'معدل جودة الأدلة' : 'Evidence Quality Score'}
                    </span>
                    <Badge variant="secondary" className="bg-[#2699A6]/10 text-[#2699A6] border-[#2699A6]/20">
                      88%
                    </Badge>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                    <div className="bg-gradient-to-r from-[#2699A6] to-[#1e7a85] h-3 rounded-full transition-all duration-300" style={{ width: '88%' }}></div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {language === 'ar' ? 'مشاركة الفريق' : 'Team Engagement'}
                    </span>
                    <Badge variant="secondary" className="bg-[#2699A6]/10 text-[#2699A6] border-[#2699A6]/20">
                      75%
                    </Badge>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                    <div className="bg-gradient-to-r from-[#2699A6] to-[#1e7a85] h-3 rounded-full transition-all duration-300" style={{ width: '75%' }}></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}