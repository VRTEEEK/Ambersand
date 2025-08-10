import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from "@/hooks/use-i18n";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Activity, Target, Users, Clock, FileText, CheckCircle2, Archive, RefreshCw } from 'lucide-react';

// Sample data based on the reference image
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

// Internal and External Scores data
const frameworkScores = [
  { name: 'ECC', internal: 50, external: 50 },
  { name: 'DCC', internal: 70, external: 70 },
  { name: 'PDPL', internal: 10, external: 10 },
  { name: 'NDMO', internal: 85, external: 85 },
  { name: 'CSCC', internal: 100, external: 100 },
  { name: 'SAMA', internal: 40, external: 40 }
];

// Control Status Trend data
const controlStatusTrendData = [
  { name: 'Open', value: 4 },
  { name: 'Submitted', value: 3 },
  { name: 'Review', value: 4 },
  { name: 'Approved', value: 5 },
  { name: 'Reopened', value: 3 }
];

// Evidence Submission Lag data
const evidenceSubmissionLagData = [
  { name: 'Omar', value: 85 },
  { name: 'Abdullah', value: 60 },
  { name: 'Ali', value: 35 },
  { name: 'Muhammed', value: 70 }
];

// Evidence Review Lag data
const evidenceReviewLagData = [
  { name: 'Omar', value: 75 },
  { name: 'Abdullah', value: 55 },
  { name: 'Ali', value: 30 },
  { name: 'Muhammed', value: 65 }
];

// Number of Tasks per Owner data
const tasksPerOwnerData = [
  { name: 'Omar', value: 90 },
  { name: 'Abdullah', value: 65 },
  { name: 'Ali', value: 45 },
  { name: 'Muhammed', value: 85 }
];

const COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#e11d48'];

export default function Analytics() {
  const { language, t } = useI18n();

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white">
              {language === 'ar' ? 'التحليلات والتقارير' : 'Analytics & Reports'}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              {language === 'ar' ? 'مراجعة شاملة لمقاييس الامتثال والأداء' : 'Comprehensive overview of compliance metrics and performance'}
            </p>
          </div>
        </div>

        {/* Top Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          {/* Compliance Frameworks */}
          <Card className="text-center p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <CardContent className="p-0">
              <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{topStatsData.complianceFrameworks}</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                {language === 'ar' ? 'أطر الامتثال' : 'Compliance'}<br />
                {language === 'ar' ? '' : 'Frameworks'}
              </div>
            </CardContent>
          </Card>

          {/* Open Projects */}
          <Card className="text-center p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <CardContent className="p-0">
              <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{topStatsData.openProjects}</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                {language === 'ar' ? 'المشاريع' : 'Open'}<br />
                {language === 'ar' ? 'المفتوحة' : 'Projects'}
              </div>
            </CardContent>
          </Card>

          {/* Open Tasks */}
          <Card className="text-center p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <CardContent className="p-0">
              <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{topStatsData.openTasks}</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                {language === 'ar' ? 'المهام' : 'Open Tasks'}<br />
                {language === 'ar' ? 'المفتوحة' : ''}
              </div>
            </CardContent>
          </Card>

          {/* Closed Tasks */}
          <Card className="text-center p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <CardContent className="p-0">
              <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{topStatsData.closedTasks}</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                {language === 'ar' ? 'المهام' : 'Closed Tasks'}<br />
                {language === 'ar' ? 'المغلقة' : ''}
              </div>
            </CardContent>
          </Card>

          {/* Approved Evidences */}
          <Card className="text-center p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <CardContent className="p-0">
              <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{topStatsData.approvedEvidences}</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                {language === 'ar' ? 'الأدلة' : 'Approved'}<br />
                {language === 'ar' ? 'المعتمدة' : 'Evidences'}
              </div>
            </CardContent>
          </Card>

          {/* Archived Projects */}
          <Card className="text-center p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <CardContent className="p-0">
              <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{topStatsData.archivedProjects}</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                {language === 'ar' ? 'المشاريع' : 'Archived'}<br />
                {language === 'ar' ? 'المؤرشفة' : 'Projects'}
              </div>
            </CardContent>
          </Card>

          {/* Re-Opened Controls */}
          <Card className="text-center p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <CardContent className="p-0">
              <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{topStatsData.reopenedControls}</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                {language === 'ar' ? 'الضوابط' : 'Re-Opened'}<br />
                {language === 'ar' ? 'المعاد فتحها' : 'Controls'}
              </div>
            </CardContent>
          </Card>

          {/* Evidence Submission Lag */}
          <Card className="text-center p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <CardContent className="p-0">
              <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{topStatsData.evidenceSubmissionLag}</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                {language === 'ar' ? 'تأخير تقديم' : 'Evidence'}<br />
                {language === 'ar' ? 'الأدلة' : 'Submission Lag'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Internal & External Scores */}
          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                {language === 'ar' ? 'النتائج الداخلية والخارجية' : 'Internal & External Scores'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {frameworkScores.map((item, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{item.name}</span>
                      <div className="flex gap-4">
                        <span className="text-slate-600 dark:text-slate-400">
                          {language === 'ar' ? 'داخلي' : 'Internal'}: {item.internal}%
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          {language === 'ar' ? 'خارجي' : 'External'}: {item.external}%
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Progress value={item.internal} className="h-2" />
                      </div>
                      <div className="flex-1">
                        <Progress value={item.external} className="h-2" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Control Status Trend */}
          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                {language === 'ar' ? 'اتجاه حالة الضوابط' : 'Control Status Trend'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={controlStatusTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Evidence Submission Lag Per Collaborator */}
          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                {language === 'ar' ? 'تأخير تقديم الأدلة لكل متعاون' : 'Evidence Submission Lag Per Collaborator'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {evidenceSubmissionLagData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{item.name}</span>
                    <div className="flex-1 mx-4">
                      <Progress value={item.value} className="h-2" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Empty space for balance */}
          <div className="lg:col-span-1"></div>

          {/* Evidence Review Lag Per Compliance Officer */}
          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                {language === 'ar' ? 'تأخير مراجعة الأدلة لكل مسؤول امتثال' : 'Evidence Review Lag Per Compliance Officer'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {evidenceReviewLagData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{item.name}</span>
                    <div className="flex-1 mx-4">
                      <Progress value={item.value} className="h-2" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Number of Tasks per Owner */}
          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                {language === 'ar' ? 'عدد المهام لكل مالك' : 'Number of Tasks per Owner'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tasksPerOwnerData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{item.name}</span>
                    <div className="flex-1 mx-4">
                      <Progress value={item.value} className="h-2" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        
      </div>
    </AppLayout>
  );
}