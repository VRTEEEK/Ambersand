import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/hooks/use-i18n';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Shield } from 'lucide-react';
import { Link } from 'wouter';

interface DomainStats {
  name_en: string;
  name_ar: string;
  approved: number;
  total: number;
}

interface RegulationData {
  project_id: string;
  regulation_id: string;
  regulation_code: string;
  logo_url: string;
  title_en: string;
  title_ar: string;
  domains: DomainStats[];
}

interface RegulationBannerProps {
  projectId?: number;
}

export function RegulationBanner({ projectId = 39 }: RegulationBannerProps) {
  const { language, t } = useI18n();

  const { data: regulationData, isLoading } = useQuery<RegulationData>({
    queryKey: [`/api/projects/${projectId}/regulations/ecc/domains`],
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-48 bg-muted animate-pulse rounded-2xl" />
        <div className="h-32 bg-muted animate-pulse rounded-2xl" />
      </div>
    );
  }

  const isRTL = language === 'ar';

  return (
    <div className="space-y-6">
      {/* ECC Regulation Banner */}
      <Card className="bg-gradient-to-r from-primary/5 via-transparent to-primary/5 border-primary/20 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-8">
          <div className={`flex items-center gap-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {/* Logo */}
            <div className="flex-shrink-0">
              <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center">
                <Shield className="w-8 h-8 text-primary" />
              </div>
            </div>
            
            {/* Title Section */}
            <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-foreground">
                  {language === 'ar' ? regulationData?.title_ar : regulationData?.title_en}
                </h1>
                <Badge variant="secondary" className="text-xs">
                  {regulationData?.regulation_code}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {language === 'ar' 
                  ? 'هيئة الأمن السيبراني - المملكة العربية السعودية'
                  : 'National Cybersecurity Authority - Kingdom of Saudi Arabia'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Domain Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {regulationData?.domains.map((domain, index) => (
          <Link
            key={domain.name_en}
            href={`/projects/${projectId}/regulations/ecc?domain=${encodeURIComponent(domain.name_en)}`}
          >
            <Card className="bg-primary/5 border-primary/20 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group">
              <CardContent className="p-6 text-center">
                <div className="space-y-3">
                  <div className="text-2xl font-bold text-primary group-hover:text-primary/80 transition-colors">
                    {domain.approved}/{domain.total}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {language === 'ar' ? domain.name_ar : domain.name_en}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {language === 'ar' ? 'ضوابط' : 'Controls'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Add More Regulations Card */}
      <Card className="border-2 border-dashed border-primary/30 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group">
        <CardContent className="p-8">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Plus className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">
                {language === 'ar' ? 'إضافة المزيد من الأنظمة' : 'Add more regulations'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {language === 'ar' 
                  ? 'أضف أنظمة أخرى مثل PDPL وNDMO لإدارة شاملة للامتثال'
                  : 'Add other regulations like PDPL and NDMO for comprehensive compliance management'
                }
              </p>
            </div>
            <Button variant="outline" className="mt-4">
              {language === 'ar' ? 'إضافة نظام' : 'Add Regulation'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}