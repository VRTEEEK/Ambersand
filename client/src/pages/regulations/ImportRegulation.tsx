import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/hooks/use-i18n';
import { Download, Upload, FileSpreadsheet, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { downloadTemplate, importRegulation, getVersions } from '@/lib/api/regulations';
import AppLayout from '@/components/layout/AppLayout';

interface ImportResult {
  inserted: number;
  updated: number;
  total: number;
  warnings: string[];
  errors: string[];
  sample?: Array<Record<string, any>>;
}

export default function ImportRegulation() {
  const { can } = usePermissions();
  const { toast } = useToast();
  const { t, language } = useI18n();

  // Form state
  const [code, setCode] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [version, setVersion] = useState('');
  const [publisher, setPublisher] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [lastDryRunOk, setLastDryRunOk] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch versions for the current code - must be called before any conditional returns
  const { data: versions, refetch: refetchVersions } = useQuery({
    queryKey: ['/api/admin/regulations', code, 'versions'],
    queryFn: () => getVersions(code),
    enabled: !!code && can('regulation:import'),
  });

  // Reset validation state when file, code, or version changes
  useEffect(() => { 
    setLastDryRunOk(false); 
    setResult(null); 
  }, [file, code, version]);

  // Permission check - after all hooks
  if (!can('regulation:import')) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              {language === 'ar' ? 'غير مصرح' : 'Access Denied'}
            </h2>
            <p className="text-muted-foreground">
              {language === 'ar' 
                ? 'ليس لديك صلاحية لاستيراد التنظيمات' 
                : 'You do not have permission to import regulations'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Download template handler
  const handleDownloadTemplate = async () => {
    try {
      const blob = await downloadTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'regulation-import-template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: language === 'ar' ? 'نجح التحميل' : 'Download Successful',
        description: language === 'ar' ? 'تم تحميل القالب بنجاح' : 'Template downloaded successfully',
      });
    } catch (error) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في تحميل القالب' : 'Failed to download template',
        variant: 'destructive',
      });
    }
  };

  // File drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const droppedFile = files[0];
      if (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile);
      } else {
        toast({
          title: language === 'ar' ? 'نوع ملف غير مدعوم' : 'Unsupported File Type',
          description: language === 'ar' ? 'يرجى استخدام ملفات .xlsx أو .csv فقط' : 'Please use only .xlsx or .csv files',
          variant: 'destructive',
        });
      }
    }
  };

  // File input handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    if (!selectedFile) return;
    if (!/\.(xlsx|csv)$/i.test(selectedFile.name)) {
      toast({
        title: language === 'ar' ? 'نوع ملف غير مدعوم' : 'Unsupported File Type',
        description: language === 'ar' ? 'يرجى استخدام ملفات .xlsx أو .csv فقط' : 'Please use only .xlsx or .csv files',
        variant: 'destructive',
      });
      return;
    }
    setFile(selectedFile);
    setResult(null);
    setLastDryRunOk(false);
  };

  // Import handlers
  const handleDryRun = async () => {
    if (!file || !code || !nameEn || !version) {
      toast({
        title: language === 'ar' ? 'بيانات مطلوبة' : 'Required Fields',
        description: language === 'ar' 
          ? 'يرجى ملء جميع الحقول المطلوبة وتحديد ملف'
          : 'Please fill all required fields and select a file',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('code', code);
      formData.append('nameEn', nameEn);
      formData.append('nameAr', nameAr);
      formData.append('version', version);
      formData.append('publisher', publisher);

      const response = await importRegulation(formData, { dryRun: true });
      setResult(response);
      setLastDryRunOk(response.errors.length === 0);
      
      toast({
        title: language === 'ar' ? 'اكتملت المعاينة' : 'Dry Run Completed',
        description: `${response.total} rows processed, ${response.errors.length} errors found`,
      });
    } catch (error) {
      toast({
        title: language === 'ar' ? 'خطأ في المعاينة' : 'Dry Run Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file || !code || !nameEn || !version) {
      toast({
        title: language === 'ar' ? 'بيانات مطلوبة' : 'Required Fields',
        description: language === 'ar' 
          ? 'يرجى ملء جميع الحقول المطلوبة وتحديد ملف'
          : 'Please fill all required fields and select a file',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('code', code);
      formData.append('nameEn', nameEn);
      formData.append('nameAr', nameAr);
      formData.append('version', version);
      formData.append('publisher', publisher);

      const response = await importRegulation(formData, { dryRun: false });
      setResult(response);
      
      toast({
        title: language === 'ar' ? 'نجح الاستيراد' : 'Import Successful',
        description: `${response.inserted} inserted, ${response.updated} updated`,
      });

      // Refresh versions and reset validation state after successful import
      if (code) {
        refetchVersions();
      }
      setLastDryRunOk(false);
      
    } catch (error) {
      toast({
        title: language === 'ar' ? 'فشل الاستيراد' : 'Import Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
      {/* Main Import Form */}
      <Card>
        <CardHeader className="flex items-center justify-between flex-row">
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {language === 'ar' ? 'استيراد التنظيم (.xlsx / .csv)' : 'Import Regulation (.xlsx / .csv)'}
          </CardTitle>
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            {language === 'ar' ? 'تحميل قالب CSV' : 'Download CSV Template'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="code">{language === 'ar' ? 'الكود' : 'Code'}</Label>
              <Input 
                id="code"
                value={code} 
                onChange={e => setCode(e.target.value)} 
                placeholder="ECC / DCC / CUSTOM" 
              />
              <p className="text-xs text-muted-foreground mt-1">
                {language === 'ar' 
                  ? 'استخدم كود قصير (مثال: ECC، DCC، HRPOLICY)'
                  : 'Use a short code (e.g. ECC, DCC, HRPOLICY).'
                }
              </p>
            </div>
            <div>
              <Label htmlFor="version">{language === 'ar' ? 'الإصدار' : 'Version'}</Label>
              <Input 
                id="version"
                value={version} 
                onChange={e => setVersion(e.target.value)} 
                placeholder="2024-v0.4" 
              />
              <p className="text-xs text-muted-foreground mt-1">
                {language === 'ar' 
                  ? 'اتبع النمط الدلالي (مثال: 2024-v0.4)'
                  : 'Follow semantic style (e.g. 2024-v0.4).'
                }
              </p>
            </div>
            <div>
              <Label htmlFor="nameEn">{language === 'ar' ? 'الاسم (إنجليزي)' : 'Name (English)'}</Label>
              <Input 
                id="nameEn"
                value={nameEn} 
                onChange={e => setNameEn(e.target.value)} 
              />
            </div>
            <div>
              <Label htmlFor="nameAr">{language === 'ar' ? 'الاسم (عربي) — اختياري' : 'Name (Arabic) — optional'}</Label>
              <Input 
                id="nameAr"
                value={nameAr} 
                onChange={e => setNameAr(e.target.value)} 
                dir="rtl" 
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="publisher">{language === 'ar' ? 'الناشر — اختياري' : 'Publisher — optional'}</Label>
              <Input 
                id="publisher"
                value={publisher} 
                onChange={e => setPublisher(e.target.value)} 
                placeholder="NCA / Custom" 
              />
            </div>
          </div>

          {/* File Upload Area */}
          <div
            role="button"
            tabIndex={0}
            aria-label={language === 'ar' ? 'تحميل ملف .xlsx أو .csv' : 'Upload .xlsx or .csv file'}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && document.getElementById('reg-file')?.click()}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="border-2 border-dashed rounded-xl p-6 text-center text-sm text-muted-foreground"
          >
            {file ? (
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                {language === 'ar' 
                  ? `المحدد: ${file.name} (${(file.size/1024/1024).toFixed(1)} ميجابايت)` 
                  : `Selected: ${file.name} (${(file.size/1024/1024).toFixed(1)} MB)`
                }
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                {language === 'ar' 
                  ? 'اسحب وأفلت ملف .xlsx/.csv هنا، أو اختر ملف'
                  : 'Drag & drop .xlsx/.csv here, or choose a file'
                }
              </div>
            )}
            <div className="mt-3">
              <Input 
                id="reg-file"
                type="file" 
                accept=".xlsx,.csv" 
                onChange={handleFileChange}
                className="cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Switch 
                      checked={dryRun} 
                      onCheckedChange={setDryRun} 
                      id="dryrun" 
                      aria-label={language === 'ar' ? 'معاينة أولاً' : 'Dry-run first'}
                      className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted border-2 border-muted-foreground/20 data-[state=checked]:border-primary/50"
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {language === 'ar' 
                        ? 'المعاينة تحاكي الاستيراد: تتحقق من الصفوف وتعرض الإدخال/التحديث/الأخطاء دون الحفظ'
                        : 'Dry-run simulates the import: validates rows and shows insert/update/errors without saving.'
                      }
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Label htmlFor="dryrun">
                {language === 'ar' ? 'معاينة أولاً' : 'Dry-run first'}
              </Label>
            </div>
            <div className="flex gap-2">
              {dryRun ? (
                <>
                  <Button 
                    variant="outline" 
                    onClick={handleDryRun} 
                    disabled={!file || loading}
                  >
                    {loading ? '...' : (language === 'ar' ? 'تشغيل المعاينة' : 'Run Dry-Run')}
                  </Button>
                  <Button 
                    onClick={handleImport} 
                    disabled={
                      !file || loading ||
                      (dryRun && (!lastDryRunOk || (result?.errors?.length ?? 0) > 0))
                    }
                  >
                    {loading ? '...' : (language === 'ar' ? 'استيراد' : 'Import')}
                  </Button>
                </>
              ) : (
                <Button 
                  onClick={handleImport} 
                  disabled={!file || loading}
                >
                  {loading ? '...' : (language === 'ar' ? 'استيراد' : 'Import')}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>
              {dryRun 
                ? (language === 'ar' ? 'نتائج المعاينة' : 'Dry-Run Results')
                : (language === 'ar' ? 'نتيجة الاستيراد' : 'Import Results')
              }
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-4 text-sm">
              <Badge variant="secondary">
                {language === 'ar' ? `مُدخل: ${result.inserted}` : `Inserted: ${result.inserted}`}
              </Badge>
              <Badge variant="secondary">
                {language === 'ar' ? `محدث: ${result.updated}` : `Updated: ${result.updated}`}
              </Badge>
              <Badge variant="secondary">
                {language === 'ar' ? `المجموع: ${result.total}` : `Total: ${result.total}`}
              </Badge>
            </div>

            {result.warnings && result.warnings.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <div className="font-medium">
                  {language === 'ar' ? 'تحذيرات' : 'Warnings'}
                </div>
                <div className="text-sm">
                  {result.warnings.slice(0, 5).join('; ')}
                </div>
              </Alert>
            )}

            {result.errors && result.errors.length > 0 && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <div className="font-medium">
                  {language === 'ar' ? 'أخطاء' : 'Errors'}
                </div>
                <div className="text-sm">
                  {result.errors.slice(0, 5).join('; ')}
                </div>
              </Alert>
            )}

            {result.sample && result.sample.length > 0 && (
              <div className="border rounded-md overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(result.sample[0]).map(header => (
                        <TableHead key={header}>{header}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.sample.map((row, index) => (
                      <TableRow key={index}>
                        {Object.values(row).map((cell: any, cellIndex) => (
                          <TableCell key={cellIndex} className="text-xs">
                            {String(cell).substring(0, 50)}
                            {String(cell).length > 50 ? '...' : ''}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Versions */}
      <Card>
        <CardHeader>
          <CardTitle>
            {language === 'ar' 
              ? `إصدارات ${code || '…'}` 
              : `Versions for ${code || '…'}`
            }
          </CardTitle>
        </CardHeader>
        <CardContent>
          {versions && versions.length > 0 ? (
            <div className="space-y-2">
              {versions.map((v: any) => (
                <div key={v.id || v.version} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <span className="font-medium">{v.version}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {new Date(v.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <Badge variant={v.status === 'active' ? 'default' : 'secondary'}>
                    {v.status === 'active' ? 
                      (language === 'ar' ? 'نشط' : 'Active') : 
                      (language === 'ar' ? 'مؤرشف' : 'Archived')
                    }
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              {code ? 
                (language === 'ar' ? 'لا توجد إصدارات لهذا الكود' : 'No versions found for this code') :
                (language === 'ar' ? 'أدخل كود التنظيم لعرض الإصدارات' : 'Enter a regulation code to see versions')
              }
            </p>
          )}
        </CardContent>
      </Card>
      </div>
    </AppLayout>
  );
}