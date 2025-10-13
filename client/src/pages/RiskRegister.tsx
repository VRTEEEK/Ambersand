import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Search, Filter, Calendar } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { useI18n } from "@/hooks/use-i18n";
import { listRisks, getSeverityColor, getStatusColor, type RiskItem, type RiskStatus, type RiskSeverity } from "@/lib/api/risk";

export default function RiskRegister() {
  const { language, isRTL } = useI18n();
  const [statusFilter, setStatusFilter] = useState<RiskStatus | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<RiskSeverity | "all">("all");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Build query parameters
  const queryParams = new URLSearchParams();
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (severityFilter !== "all") queryParams.set("severity", severityFilter);
  if (assigneeFilter) queryParams.set("assigneeId", assigneeFilter);
  if (searchQuery) queryParams.set("q", searchQuery);

  const { data: risksData, isLoading, error } = useQuery({
    queryKey: ["/api/risks", queryParams.toString()],
    queryFn: () => listRisks(queryParams),
  });

  const risks = risksData?.items || [];

  return (
    <AppLayout>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <AlertTriangle className="h-8 w-8 text-red-500" />
          <div>
            <h1 className="text-3xl font-bold">{language === 'ar' ? 'سجل المخاطر' : 'Risk Register'}</h1>
            <p className="text-muted-foreground">{language === 'ar' ? 'مراقبة وإدارة مخاطر الامتثال' : 'Monitor and manage compliance risks'}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>{language === 'ar' ? 'الفلاتر' : 'Filters'}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={language === 'ar' ? 'بحث في المخاطر...' : 'Search risks...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as RiskStatus | "all")}>
              <SelectTrigger>
                <SelectValue placeholder={language === 'ar' ? 'كل الحالات' : 'All Statuses'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === 'ar' ? 'كل الحالات' : 'All Statuses'}</SelectItem>
                <SelectItem value="not-started">{language === 'ar' ? 'لم يبدأ' : 'Not Started'}</SelectItem>
                <SelectItem value="in-progress">{language === 'ar' ? 'قيد التنفيذ' : 'In Progress'}</SelectItem>
                <SelectItem value="mitigated">{language === 'ar' ? 'تم التخفيف' : 'Mitigated'}</SelectItem>
                <SelectItem value="under-review">{language === 'ar' ? 'قيد المراجعة' : 'Under Review'}</SelectItem>
                <SelectItem value="completed">{language === 'ar' ? 'مكتمل' : 'Completed'}</SelectItem>
              </SelectContent>
            </Select>

            {/* Severity Filter */}
            <Select value={severityFilter} onValueChange={(value) => setSeverityFilter(value as RiskSeverity | "all")}>
              <SelectTrigger>
                <SelectValue placeholder={language === 'ar' ? 'كل الخطورة' : 'All Severities'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === 'ar' ? 'كل الخطورة' : 'All Severities'}</SelectItem>
                <SelectItem value="low">{language === 'ar' ? 'منخفض' : 'Low'}</SelectItem>
                <SelectItem value="medium">{language === 'ar' ? 'متوسط' : 'Medium'}</SelectItem>
                <SelectItem value="high">{language === 'ar' ? 'عالي' : 'High'}</SelectItem>
                <SelectItem value="critical">{language === 'ar' ? 'حرج' : 'Critical'}</SelectItem>
                <SelectItem value="urgent">{language === 'ar' ? 'عاجل' : 'Urgent'}</SelectItem>
              </SelectContent>
            </Select>

            {/* Assignee Filter */}
            <Input
              placeholder={language === 'ar' ? 'تصفية حسب المكلف...' : 'Filter by assignee...'}
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Risk List */}
      <Card>
        <CardHeader>
          <CardTitle>{language === 'ar' ? `المخاطر (${risks.length})` : `Risks (${risks.length})`}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              {language === 'ar' ? 'فشل تحميل المخاطر' : 'Failed to load risks'}
            </div>
          ) : risks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === 'ar' ? 'لا توجد مخاطر تطابق معاييرك' : 'No risks found matching your criteria'}
            </div>
          ) : (
            <div className="space-y-4">
              {risks.map((risk: RiskItem) => (
                <RiskCard key={risk.id} risk={risk} language={language} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </AppLayout>
  );
}

function RiskCard({ risk, language }: { risk: RiskItem; language: 'en' | 'ar' }) {
  const getSeverityText = (severity: string) => {
    const translations = {
      low: language === 'ar' ? 'منخفض' : 'Low',
      medium: language === 'ar' ? 'متوسط' : 'Medium',
      high: language === 'ar' ? 'عالي' : 'High',
      critical: language === 'ar' ? 'حرج' : 'Critical',
      urgent: language === 'ar' ? 'عاجل' : 'Urgent',
    };
    return translations[severity as keyof typeof translations] || severity;
  };

  const getStatusText = (status: string) => {
    const translations = {
      'not-started': language === 'ar' ? 'لم يبدأ' : 'Not Started',
      'in-progress': language === 'ar' ? 'قيد التنفيذ' : 'In Progress',
      'mitigated': language === 'ar' ? 'تم التخفيف' : 'Mitigated',
      'under-review': language === 'ar' ? 'قيد المراجعة' : 'Under Review',
      'completed': language === 'ar' ? 'مكتمل' : 'Completed',
    };
    return translations[status as keyof typeof translations] || status;
  };

  return (
    <Link href={`/risks/${risk.id}`}>
      <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3 mb-2">
              <h3 className="font-semibold truncate">{risk.title}</h3>
              <Badge className={getSeverityColor(risk.severity)}>
                {getSeverityText(risk.severity)}
              </Badge>
              <Badge className={getStatusColor(risk.status)}>
                {getStatusText(risk.status)}
              </Badge>
            </div>
            
            {risk.riskDescription && (
              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                {risk.riskDescription}
              </p>
            )}

            <div className="flex items-center space-x-4 text-xs text-muted-foreground">
              <span className="flex items-center space-x-1">
                <Calendar className="h-3 w-3" />
                <span>{language === 'ar' ? 'تم التحديث ' : 'Updated '}{new Date(risk.updatedAt).toLocaleDateString()}</span>
              </span>
              {risk.assigneeId && (
                <span>{language === 'ar' ? 'مُكلف إلى: ' : 'Assigned to: '}{risk.assigneeId}</span>
              )}
              <button
                type="button"
                className="text-primary hover:underline text-left"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.location.href = `/tasks/${risk.taskId}`;
                }}
              >
                {language === 'ar' ? 'عرض المهمة' : 'View Task'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}