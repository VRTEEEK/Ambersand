import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/hooks/use-i18n';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { Link } from 'wouter';
import ncaLogoPath from "@assets/image_1754845978121.png";

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
      <Card className="bg-card border-border rounded-2xl shadow-sm hover:shadow-lg transition-shadow duration-200">
        <CardContent className="p-8">
          <div className={`flex items-center gap-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {/* NCA Logo */}
            <div className="flex-shrink-0">
              <div className="w-20 h-20 bg-white rounded-2xl p-3 shadow-sm border border-border/50">
                <img 
                  src={ncaLogoPath} 
                  alt="National Cybersecurity Authority" 
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            
            {/* Title Section */}
            <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
              <div className={`flex items-center gap-3 mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <h1 className="text-2xl font-bold text-foreground">
                  {language === 'ar' ? regulationData?.title_ar : regulationData?.title_en}
                </h1>
                <Badge variant="secondary" className="text-xs font-medium">
                  {regulationData?.regulation_code}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {regulationData?.domains.map((domain, index) => (
          <Link
            key={domain.name_en}
            href={`/projects/${projectId}?domain=${encodeURIComponent(domain.name_en)}`}
          >
            <Card className="bg-primary/8 border-primary/20 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer group hover:bg-primary/12">
              <CardContent className="p-6 text-center">
                <div className="space-y-4">
                  <div className="text-3xl font-bold text-primary group-hover:scale-105 transition-transform duration-200">
                    {domain.approved}/{domain.total}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-foreground leading-tight">
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
      <Card className="border-2 border-dashed border-primary/30 bg-card rounded-2xl shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer group hover:border-primary/50">
        <CardContent className="p-10">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center group-hover:bg-primary/20 group-hover:scale-105 transition-all duration-200">
              <Plus className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-foreground">
                {language === 'ar' ? 'إضافة المزيد من الأنظمة' : 'Add more regulations'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                {language === 'ar' 
                  ? 'أضف أنظمة أخرى مثل PDPL وNDMO لإدارة شاملة للامتثال'
                  : 'Add other regulations like PDPL and NDMO for comprehensive compliance management'
                }
              </p>
            </div>
            <Button variant="outline" className="mt-6 px-6 py-3 font-medium">
              {language === 'ar' ? 'إضافة نظام' : 'Add Regulation'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}