import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/hooks/use-i18n';
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  Shield, 
  Settings,
  Plus,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  BarChart3
} from 'lucide-react';

interface RegulationDomainCompliance {
  domain: string;
  domainAr: string;
  completed: number;
  total: number;
  percentage: number;
  status: 'excellent' | 'good' | 'needs-improvement' | 'critical';
}

interface RegulationCompliance {
  id: string;
  name: string;
  nameAr: string;
  icon: React.ReactNode;
  color: string;
  domains: RegulationDomainCompliance[];
  overallCompliance: number;
  totalControls: number;
  completedControls: number;
}

export default function Regulations() {
  const { language } = useI18n();
  
  // Mock data based on the reference image - in real implementation, this would come from API
  const regulationComplianceData: RegulationCompliance[] = [
    {
      id: 'ecc',
      name: 'Essential Cybersecurity Controls',
      nameAr: 'الضوابط الأساسية للأمن السيبراني',
      icon: <Shield className="w-6 h-6" />,
      color: 'bg-blue-500',
      overallCompliance: 41,
      totalControls: 201,
      completedControls: 83,
      domains: [
        {
          domain: 'Cybersecurity Governance',
          domainAr: 'حوكمة الأمن السيبراني',
          completed: 30,
          total: 50,
          percentage: 60,
          status: 'good'
        },
        {
          domain: 'Cybersecurity Defense',
          domainAr: 'دفاع الأمن السيبراني',
          completed: 60,
          total: 70,
          percentage: 86,
          status: 'excellent'
        },
        {
          domain: 'Cybersecurity Resilience',
          domainAr: 'مرونة الأمن السيبراني',
          completed: 20,
          total: 40,
          percentage: 50,
          status: 'needs-improvement'
        },
        {
          domain: 'Cybersecurity Third Party',
          domainAr: 'الأمن السيبراني للطرف الثالث',
          completed: 13,
          total: 40,
          percentage: 33,
          status: 'critical'
        }
      ]
    },
    {
      id: 'pdpl',
      name: 'Personal Data Protection Law',
      nameAr: 'نظام حماية البيانات الشخصية',
      icon: <Settings className="w-6 h-6" />,
      color: 'bg-green-500',
      overallCompliance: 75,
      totalControls: 45,
      completedControls: 34,
      domains: [
        {
          domain: 'Data Governance',
          domainAr: 'حوكمة البيانات',
          completed: 15,
          total: 18,
          percentage: 83,
          status: 'excellent'
        },
        {
          domain: 'Data Rights',
          domainAr: 'حقوق البيانات',
          completed: 12,
          total: 15,
          percentage: 80,
          status: 'excellent'
        },
        {
          domain: 'Data Security',
          domainAr: 'أمن البيانات',
          completed: 7,
          total: 12,
          percentage: 58,
          status: 'good'
        }
      ]
    },
    {
      id: 'ndmo',
      name: 'National Data Management Office',
      nameAr: 'مكتب إدارة البيانات الوطنية',
      icon: <BarChart3 className="w-6 h-6" />,
      color: 'bg-purple-500',
      overallCompliance: 45,
      totalControls: 28,
      completedControls: 13,
      domains: [
        {
          domain: 'Data Classification',
          domainAr: 'تصنيف البيانات',
          completed: 8,
          total: 15,
          percentage: 53,
          status: 'needs-improvement'
        },
        {
          domain: 'Data Quality',
          domainAr: 'جودة البيانات',
          completed: 5,
          total: 13,
          percentage: 38,
          status: 'critical'
        }
      ]
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-blue-500';
      case 'needs-improvement': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'excellent': return language === 'ar' ? 'ممتاز' : 'Excellent';
      case 'good': return language === 'ar' ? 'جيد' : 'Good';
      case 'needs-improvement': return language === 'ar' ? 'يحتاج تحسين' : 'Needs Improvement';
      case 'critical': return language === 'ar' ? 'حرج' : 'Critical';
      default: return '';
    }
  };

  const getComplianceIcon = (percentage: number) => {
    if (percentage >= 80) return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    if (percentage >= 60) return <TrendingUp className="w-5 h-5 text-blue-600" />;
    if (percentage >= 40) return <Clock className="w-5 h-5 text-yellow-600" />;
    return <AlertTriangle className="w-5 h-5 text-red-600" />;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {language === 'ar' ? 'الأنظمة واللوائح' : 'Regulations'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {language === 'ar' 
                ? 'مراقبة امتثال المؤسسة للأنظمة واللوائح المختلفة' 
                : 'Monitor organizational compliance across different regulations and frameworks'
              }
            </p>
          </div>
          <Button className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {language === 'ar' ? 'إضافة نظام جديد' : 'Add Regulation'}
          </Button>
        </div>

        {/* Regulations Grid */}
        <div className="grid grid-cols-1 gap-6">
          {regulationComplianceData.map((regulation) => (
            <Card key={regulation.id} className="bg-card border-border hover:shadow-lg transition-all duration-200">
              <CardHeader className="border-b border-border/50 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-xl ${regulation.color}/10 flex items-center justify-center`}>
                      <div className={`text-white p-2 rounded-lg ${regulation.color}`}>
                        {regulation.icon}
                      </div>
                    </div>
                    <div>
                      <CardTitle className="text-lg text-foreground">
                        {language === 'ar' ? regulation.nameAr : regulation.name}
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        {language === 'ar' 
                          ? `${regulation.completedControls} من ${regulation.totalControls} ضابط مكتمل`
                          : `${regulation.completedControls} of ${regulation.totalControls} controls completed`
                        }
                      </CardDescription>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="flex items-center gap-2 mb-2">
                      {getComplianceIcon(regulation.overallCompliance)}
                      <span className="text-2xl font-bold text-foreground">
                        {regulation.overallCompliance}%
                      </span>
                    </div>
                    <Badge 
                      variant="secondary" 
                      className={`${getStatusColor(
                        regulation.overallCompliance >= 80 ? 'excellent' :
                        regulation.overallCompliance >= 60 ? 'good' :
                        regulation.overallCompliance >= 40 ? 'needs-improvement' : 'critical'
                      )} text-white`}
                    >
                      {getStatusText(
                        regulation.overallCompliance >= 80 ? 'excellent' :
                        regulation.overallCompliance >= 60 ? 'good' :
                        regulation.overallCompliance >= 40 ? 'needs-improvement' : 'critical'
                      )}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {regulation.domains.map((domain, index) => (
                    <div key={index} className="bg-muted/30 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm text-foreground">
                          {language === 'ar' ? domain.domainAr : domain.domain}
                        </h4>
                        <Badge 
                          variant="outline" 
                          className={`${getStatusColor(domain.status)} text-white border-transparent text-xs`}
                        >
                          {getStatusText(domain.status)}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {language === 'ar' ? 'مكتمل' : 'Completed'}
                          </span>
                          <span className="font-medium text-foreground">
                            {domain.completed}/{domain.total}
                          </span>
                        </div>
                        <Progress value={domain.percentage} className="h-2" />
                        <div className="text-right">
                          <span className="text-lg font-bold text-foreground">
                            {domain.percentage}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Add More Regulations Section */}
        <Card className="border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors duration-200">
          <CardContent className="p-8 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
                <Plus className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {language === 'ar' ? 'إضافة المزيد من الأنظمة' : 'Add more regulations'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {language === 'ar' 
                    ? 'قم بإضافة وتتبع أنظمة ولوائح إضافية حسب احتياجات مؤسستك'
                    : 'Add and track additional regulations and frameworks based on your organization needs'
                  }
                </p>
                <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-white">
                  {language === 'ar' ? 'بدء الإعداد' : 'Start Setup'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}