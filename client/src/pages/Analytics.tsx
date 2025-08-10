import { useState } from 'react';
import { useI18n } from "@/hooks/use-i18n";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Target, 
  Users, 
  Clock, 
  FileText, 
  CheckCircle2, 
  Archive, 
  RefreshCw,
  BarChart3,
  PieChart,
  Calendar,
  Shield,
  FolderOpen
} from 'lucide-react';

// Top statistics data matching the reference image
const topStatsData = {
  complianceFrameworks: 8,
  openProjects: 7,
  openTasks: 308,
  closedTasks: 308,
  approvedEvidences: 308,
  archivedProjects: 3,
  reopenedControls: 27,
  evidenceSubmissionLag: '3 Days'
};

// Internal and External Scores data for compliance frameworks
const frameworkScores = [
  { name: 'ECC', internal: 50, external: 50, color: 'hsl(174, 36%, 45%)' },
  { name: 'DCC', internal: 70, external: 70, color: 'hsl(220, 91%, 60%)' },
  { name: 'PDPL', internal: 10, external: 10, color: 'hsl(168, 76%, 36%)' },
  { name: 'NDMO', internal: 85, external: 85, color: 'hsl(25, 95%, 53%)' },
  { name: 'CSCC', internal: 100, external: 100, color: 'hsl(262, 83%, 58%)' },
  { name: 'SAMA', internal: 40, external: 40, color: 'hsl(346, 87%, 43%)' }
];

// Control Status Trend data
const controlStatusTrendData = [
  { name: 'Open', value: 4, color: 'hsl(25, 95%, 53%)' },
  { name: 'Submitted', value: 3, color: 'hsl(220, 91%, 60%)' },
  { name: 'Review', value: 4, color: 'hsl(262, 83%, 58%)' },
  { name: 'Approved', value: 5, color: 'hsl(168, 76%, 36%)' },
  { name: 'Reopened', value: 3, color: 'hsl(346, 87%, 43%)' }
];

// Team performance data
const evidenceSubmissionLagData = [
  { name: 'Omar', value: 85, color: 'hsl(174, 36%, 45%)' },
  { name: 'Abdullah', value: 60, color: 'hsl(220, 91%, 60%)' },
  { name: 'Ali', value: 35, color: 'hsl(25, 95%, 53%)' },
  { name: 'Muhammed', value: 70, color: 'hsl(168, 76%, 36%)' }
];

const evidenceReviewLagData = [
  { name: 'Omar', value: 75, color: 'hsl(174, 36%, 45%)' },
  { name: 'Abdullah', value: 55, color: 'hsl(220, 91%, 60%)' },
  { name: 'Ali', value: 30, color: 'hsl(25, 95%, 53%)' },
  { name: 'Muhammed', value: 65, color: 'hsl(168, 76%, 36%)' }
];

const tasksPerOwnerData = [
  { name: 'Omar', value: 90, color: 'hsl(174, 36%, 45%)' },
  { name: 'Abdullah', value: 65, color: 'hsl(220, 91%, 60%)' },
  { name: 'Ali', value: 45, color: 'hsl(25, 95%, 53%)' },
  { name: 'Muhammed', value: 85, color: 'hsl(168, 76%, 36%)' }
];

export default function Analytics() {
  const { language } = useI18n();

  const statCards = [
    {
      title: language === 'ar' ? 'أطر الامتثال' : 'Compliance Frameworks',
      value: topStatsData.complianceFrameworks,
      icon: Shield,
      color: 'bg-primary/10 text-primary'
    },
    {
      title: language === 'ar' ? 'المشاريع المفتوحة' : 'Open Projects',
      value: topStatsData.openProjects,
      icon: FolderOpen,
      color: 'bg-blue-500/10 text-blue-600'
    },
    {
      title: language === 'ar' ? 'المهام المفتوحة' : 'Open Tasks',
      value: topStatsData.openTasks,
      icon: CheckCircle2,
      color: 'bg-orange-500/10 text-orange-600'
    },
    {
      title: language === 'ar' ? 'المهام المغلقة' : 'Closed Tasks',
      value: topStatsData.closedTasks,
      icon: Target,
      color: 'bg-green-500/10 text-green-600'
    },
    {
      title: language === 'ar' ? 'الأدلة المعتمدة' : 'Approved Evidences',
      value: topStatsData.approvedEvidences,
      icon: FileText,
      color: 'bg-purple-500/10 text-purple-600'
    },
    {
      title: language === 'ar' ? 'المشاريع المؤرشفة' : 'Archived Projects',
      value: topStatsData.archivedProjects,
      icon: Archive,
      color: 'bg-gray-500/10 text-gray-600'
    },
    {
      title: language === 'ar' ? 'الضوابط المعاد فتحها' : 'Re-Opened Controls',
      value: topStatsData.reopenedControls,
      icon: RefreshCw,
      color: 'bg-red-500/10 text-red-600'
    },
    {
      title: language === 'ar' ? 'تأخير تقديم الأدلة' : 'Evidence Submission Lag',
      value: topStatsData.evidenceSubmissionLag,
      icon: Clock,
      color: 'bg-yellow-500/10 text-yellow-600'
    }
  ];

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="border-b border-border pb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                {language === 'ar' ? 'التحليلات والتقارير' : 'Analytics & Reports'}
              </h1>
              <p className="text-muted-foreground">
                {language === 'ar' ? 'نظرة شاملة على مقاييس الامتثال وأداء الفريق' : 'Comprehensive overview of compliance metrics and team performance'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="px-3 py-1">
                <Calendar className="w-4 h-4 mr-2" />
                {language === 'ar' ? 'آخر تحديث: اليوم' : 'Last updated: Today'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Top Statistics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          {statCards.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <Card key={index} className="hover:shadow-md transition-shadow duration-200 bg-card border-border">
                <CardContent className="p-4 text-center">
                  <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center mx-auto mb-3`}>
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <div className="text-2xl font-bold text-foreground mb-1">
                    {stat.value}
                  </div>
                  <div className="text-xs text-muted-foreground leading-tight">
                    {stat.title}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          
          {/* Internal & External Scores */}
          <Card className="bg-card border-border hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg text-foreground">
                    {language === 'ar' ? 'النتائج الداخلية والخارجية' : 'Internal & External Scores'}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {language === 'ar' ? 'مقارنة أداء الأطر التشريعية' : 'Framework performance comparison'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-5">
                {frameworkScores.map((item, index) => (
                  <div key={index} className="bg-muted/30 rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-semibold text-foreground text-lg">{item.name}</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {/* Internal Score */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">
                            {language === 'ar' ? 'النتيجة الداخلية' : 'Internal Score'}
                          </span>
                          <span className="text-sm font-bold text-foreground">{item.internal}%</span>
                        </div>
                        <Progress 
                          value={item.internal} 
                          className="h-3"
                        />
                      </div>

                      {/* External Score */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">
                            {language === 'ar' ? 'النتيجة الخارجية' : 'External Score'}
                          </span>
                          <span className="text-sm font-bold text-foreground">{item.external}%</span>
                        </div>
                        <Progress 
                          value={item.external} 
                          className="h-3"
                        />
                      </div>
                    </div>

                    {/* Status Indicator */}
                    <div className="flex items-center gap-2">
                      {item.internal >= 80 && item.external >= 80 ? (
                        <Badge variant="default" className="bg-green-500/10 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
                          {language === 'ar' ? 'ممتاز' : 'Excellent'}
                        </Badge>
                      ) : item.internal >= 60 && item.external >= 60 ? (
                        <Badge variant="default" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800">
                          {language === 'ar' ? 'جيد' : 'Good'}
                        </Badge>
                      ) : (
                        <Badge variant="default" className="bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800">
                          {language === 'ar' ? 'يحتاج تحسين' : 'Needs Improvement'}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Control Status Trend */}
          <Card className="bg-card border-border hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg text-foreground">
                    {language === 'ar' ? 'اتجاه حالة الضوابط' : 'Control Status Trend'}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {language === 'ar' ? 'توزيع حالات الضوابط الحالية' : 'Current control status distribution'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {controlStatusTrendData.map((item, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-sm bg-primary" />
                        <span className="text-sm font-medium text-foreground">{item.name}</span>
                      </div>
                      <span className="text-sm font-bold text-foreground">{item.value}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-3">
                      <div
                        className="h-3 rounded-full transition-all duration-300 bg-primary"
                        style={{
                          width: `${(item.value / Math.max(...controlStatusTrendData.map(d => d.value))) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Evidence Submission Lag */}
          <Card className="bg-card border-border hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <CardTitle className="text-lg text-foreground">
                    {language === 'ar' ? 'تأخير تقديم الأدلة' : 'Evidence Submission Lag'}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {language === 'ar' ? 'أداء المتعاونين في تقديم الأدلة' : 'Per collaborator submission performance'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {evidenceSubmissionLagData.map((item, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{item.name}</span>
                      <span className="text-xs text-muted-foreground">{item.value}%</span>
                    </div>
                    <Progress value={item.value} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Evidence Review Lag */}
          <Card className="bg-card border-border hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <CardTitle className="text-lg text-foreground">
                    {language === 'ar' ? 'تأخير مراجعة الأدلة' : 'Evidence Review Lag'}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {language === 'ar' ? 'أداء مسؤولي الامتثال في المراجعة' : 'Per compliance officer review performance'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {evidenceReviewLagData.map((item, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{item.name}</span>
                      <span className="text-xs text-muted-foreground">{item.value}%</span>
                    </div>
                    <Progress value={item.value} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Number of Tasks per Owner */}
          <Card className="bg-card border-border hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Target className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-lg text-foreground">
                    {language === 'ar' ? 'عدد المهام لكل مالك' : 'Tasks per Owner'}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {language === 'ar' ? 'توزيع المهام بين أعضاء الفريق' : 'Task distribution across team members'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {tasksPerOwnerData.map((item, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{item.name}</span>
                      <span className="text-xs text-muted-foreground">{Math.round(item.value * 0.3)} tasks</span>
                    </div>
                    <Progress value={item.value} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Section */}
        <Card className="bg-gradient-to-r from-primary/5 via-transparent to-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div className="space-y-2">
                <div className="text-2xl font-bold text-primary">85%</div>
                <div className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'متوسط الامتثال الإجمالي' : 'Overall Compliance Average'}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-2xl font-bold text-foreground">5.2 {language === 'ar' ? 'أيام' : 'days'}</div>
                <div className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'متوسط وقت إنجاز المهام' : 'Average Task Completion Time'}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-2xl font-bold text-green-600">92%</div>
                <div className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'معدل الإنجاز في الوقت المحدد' : 'On-time Completion Rate'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}