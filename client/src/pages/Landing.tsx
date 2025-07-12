import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/hooks/use-i18n';
import { 
  Shield, 
  BookOpen, 
  BarChart3, 
  Users, 
  CheckCircle2,
  ArrowRight,
  Globe,
} from 'lucide-react';
import heroBackgroundPath from "@assets/image_1752308988455.png";
import logoPath from "@assets/Logo_1752310054852.png";

export default function Landing() {
  const { t, toggleLanguage, language } = useI18n();

  const features = [
    {
      icon: Shield,
      title: 'Comprehensive Compliance Management',
      titleAr: 'إدارة الامتثال الشاملة',
      description: 'Track and manage compliance across multiple regulations including ECC, PDPL, and NDMO with advanced monitoring and reporting.',
      descriptionAr: 'تتبع وإدارة الامتثال عبر لوائح متعددة بما في ذلك الضوابط الأساسية للأمن السيبراني ونظام حماية البيانات الشخصية ومكتب إدارة البيانات الوطنية مع المراقبة والتقارير المتقدمة.',
    },
    {
      icon: BookOpen,
      title: 'Regulation Library',
      titleAr: 'مكتبة اللوائح',
      description: 'Access detailed requirements and controls from Saudi regulatory frameworks with bilingual support and interactive navigation.',
      descriptionAr: 'الوصول إلى المتطلبات والضوابط التفصيلية من الأطر التنظيمية السعودية مع الدعم ثنائي اللغة والتنقل التفاعلي.',
    },
    {
      icon: BarChart3,
      title: 'Advanced Analytics',
      titleAr: 'التحليلات المتقدمة',
      description: 'Real-time dashboards and comprehensive reporting to track compliance progress and identify areas for improvement.',
      descriptionAr: 'لوحات قيادة في الوقت الفعلي وتقارير شاملة لتتبع تقدم الامتثال وتحديد المجالات للتحسين.',
    },
    {
      icon: Users,
      title: 'Team Collaboration',
      titleAr: 'التعاون الجماعي',
      description: 'Streamlined project management with task assignment, evidence management, and role-based access control.',
      descriptionAr: 'إدارة مشاريع مبسطة مع تعيين المهام وإدارة الأدلة والتحكم في الوصول القائم على الأدوار.',
    },
  ];

  const benefits = [
    {
      title: 'Reduce Compliance Costs',
      titleAr: 'تقليل تكاليف الامتثال',
      description: 'Streamline compliance processes and reduce manual effort',
      descriptionAr: 'تبسيط عمليات الامتثال وتقليل الجهد اليدوي',
    },
    {
      title: 'Ensure Regulatory Adherence',
      titleAr: 'ضمان الالتزام التنظيمي',
      description: 'Stay up-to-date with the latest regulatory requirements',
      descriptionAr: 'البقاء على اطلاع بأحدث المتطلبات التنظيمية',
    },
    {
      title: 'Improve Risk Management',
      titleAr: 'تحسين إدارة المخاطر',
      description: 'Identify and mitigate compliance risks proactively',
      descriptionAr: 'تحديد وتخفيف مخاطر الامتثال بشكل استباقي',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-[#ffffff]">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <img src={logoPath} alt="Ambersand Logo" className="h-8" />
            </div>
            
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={toggleLanguage} className="text-sm">
                <Globe className="h-4 w-4 mr-2" />
                {language === 'en' ? 'العربية' : 'English'}
              </Button>
              
              <Button asChild>
                <a href="/api/login">
                  {t('actions.login')}
                </a>
              </Button>
            </div>
          </div>
        </div>
      </header>
      {/* Hero Section with Background Image */}
      <section 
        className="relative py-32 lg:py-40 overflow-hidden"
        style={{
          backgroundImage: `url(${heroBackgroundPath})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-teal-900/90 via-teal-800/85 to-teal-700/90"></div>
        
        {/* Content */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          
          
          <h1 className="text-5xl lg:text-7xl font-bold text-white mb-8 leading-tight">
            {language === 'ar' 
              ? 'منصة إدارة الامتثال المتقدمة' 
              : 'Advanced Compliance Management Platform'
            }
          </h1>
          
          <p className="text-2xl text-white/90 mb-12 max-w-4xl mx-auto font-light leading-relaxed">
            {language === 'ar'
              ? 'حلول شاملة لإدارة الامتثال للمؤسسات السعودية مع دعم متعدد اللوائح والتحليلات المتقدمة وإدارة المشاريع التفاعلية'
              : 'Comprehensive compliance management solutions for Saudi organizations with multi-regulation support, advanced analytics, and interactive project management'
            }
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Button size="lg" className="bg-white text-teal-900 hover:bg-white/95 text-lg px-8 py-4 h-auto font-semibold" asChild>
              <a href="/api/login">
                {language === 'ar' ? 'ابدأ الآن' : 'Get Started'}
                <ArrowRight className="ml-2 h-6 w-6" />
              </a>
            </Button>
          </div>
          
          {/* Features highlight */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/30">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <p className="text-white/90 font-medium">
                {language === 'ar' ? 'الضوابط الأساسية للأمن السيبراني' : 'Essential Cybersecurity Controls'}
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/30">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <p className="text-white/90 font-medium">
                {language === 'ar' ? 'نظام حماية البيانات الشخصية' : 'Personal Data Protection Law'}
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/30">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <p className="text-white/90 font-medium">
                {language === 'ar' ? 'مكتب إدارة البيانات الوطنية' : 'National Data Management Office'}
              </p>
            </div>
          </div>
        </div>
      </section>
      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-800 mb-4">
              {language === 'ar' ? 'الميزات الرئيسية' : 'Key Features'}
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              {language === 'ar'
                ? 'أدوات متقدمة لتبسيط إدارة الامتثال وتحسين الكفاءة التنظيمية'
                : 'Advanced tools to streamline compliance management and improve organizational efficiency'
              }
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="glass-card hover-lift">
                  <CardHeader className="text-center">
                    <div className="w-16 h-16 bg-teal-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <Icon className="h-8 w-8 text-teal-600" />
                    </div>
                    <CardTitle className="text-lg">
                      {language === 'ar' ? feature.titleAr : feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-600 text-center">
                      {language === 'ar' ? feature.descriptionAr : feature.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
      {/* Benefits Section */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-800 mb-4">
              {language === 'ar' ? 'الفوائد المؤسسية' : 'Business Benefits'}
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-start space-x-4">
                <CheckCircle2 className="h-6 w-6 text-teal-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">
                    {language === 'ar' ? benefit.titleAr : benefit.title}
                  </h3>
                  <p className="text-slate-600">
                    {language === 'ar' ? benefit.descriptionAr : benefit.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-teal-600 to-teal-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            {language === 'ar' 
              ? 'ابدأ رحلة الامتثال الخاصة بك اليوم'
              : 'Start Your Compliance Journey Today'
            }
          </h2>
          <p className="text-xl text-teal-100 mb-8">
            {language === 'ar'
              ? 'انضم إلى المؤسسات الرائدة التي تثق في Ambersand لإدارة الامتثال'
              : 'Join leading organizations that trust Ambersand for compliance management'
            }
          </p>
          <Button size="lg" className="bg-white text-teal-600 hover:bg-slate-100" asChild>
            <a href="/api/login">
              {language === 'ar' ? 'ابدأ الآن مجاناً' : 'Get Started Free'}
              <ArrowRight className="ml-2 h-5 w-5" />
            </a>
          </Button>
        </div>
      </section>
      {/* Footer */}
      <footer className="bg-slate-800 text-slate-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <img src={logoPath} alt="Ambersand Logo" className="h-6" />
            </div>
            
            <p className="text-sm">
              {language === 'ar'
                ? '© 2024 Ambersand. جميع الحقوق محفوظة.'
                : '© 2024 Ambersand. All rights reserved.'
              }
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
