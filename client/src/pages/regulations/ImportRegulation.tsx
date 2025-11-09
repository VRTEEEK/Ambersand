import React, { useState, useEffect, useMemo } from 'react';
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
import { Download, Upload, FileSpreadsheet, AlertTriangle, CheckCircle, XCircle, ChevronLeft, ChevronRight, X } from 'lucide-react';
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
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
    setCurrentPage(1);
  }, [file, code, version]);

  // Pagination logic using useMemo - must be before any conditional returns
  const paginationData = useMemo(() => {
    if (!result?.sample || result.sample.length === 0) {
      return null;
    }

    const totalRows = result.sample.length;
    const totalPages = Math.ceil(totalRows / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, totalRows);
    const paginatedData = result.sample.slice(startIndex, endIndex);

    return {
      totalRows,
      totalPages,
      startIndex,
      endIndex,
      paginatedData,
    };
  }, [result, currentPage, rowsPerPage]);

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

  // Field validation handlers
  const validateField = (fieldName: string, value: string, displayName: string, isRequired: boolean = false) => {
    const trimmedValue = value.trim();
    
    if (trimmedValue.length === 0 && value.length > 0) {
      setFieldErrors(prev => ({
        ...prev,
        [fieldName]: language === 'ar' 
          ? `${displayName} لا يمكن أن يحتوي على مسافات فقط`
          : `${displayName} cannot contain only spaces`
      }));
      return false;
    }
    
    if (value.length > 255) {
      setFieldErrors(prev => ({
        ...prev,
        [fieldName]: language === 'ar' 
          ? `الحد الأقصى ${displayName} هو 255 حرفًا`
          : `Maximum ${displayName} is 255 characters`
      }));
      return false;
    }
    
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
    return true;
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCode(value);
    validateField('code', value, language === 'ar' ? 'الكود' : 'Code', true);
  };

  const handleVersionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setVersion(value);
    validateField('version', value, language === 'ar' ? 'الإصدار' : 'Version', true);
  };

  const handleNameEnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNameEn(value);
    validateField('nameEn', value, language === 'ar' ? 'الاسم (إنجليزي)' : 'Name (English)', true);
  };

  const handleNameArChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNameAr(value);
    validateField('nameAr', value, language === 'ar' ? 'الاسم (عربي)' : 'Name (Arabic)', false);
  };

  const handlePublisherChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPublisher(value);
    validateField('publisher', value, language === 'ar' ? 'الناشر' : 'Publisher', false);
  };

  // Helper to extract detailed error messages
  async function extractMessage(err: any) {
    if (err?.message) {
      try {
        const j = JSON.parse(err.message);
        if (j?.message) {
          const more = j.detail ? ` — ${j.detail}` : '';
          const hint = j.hint ? ` (${j.hint})` : '';
          const sample = j.sample ? `\nHeaders: ${j.sample.join(', ')}` : '';
          return j.message + more + hint + sample;
        }
      } catch {}
      return err.message;
    }
    return 'Unknown error';
  }

  // Template download handler
  async function handleDownloadTemplate() {
    try {
      const blob = await downloadTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "regulation-template.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      
      toast({
        title: language === 'ar' ? 'تم تحميل النموذج' : 'Template Downloaded',
        description: language === 'ar' ? 'تم تحميل نموذج ملف الاستيراد بنجاح' : 'Import template file downloaded successfully',
      });
    } catch (e: any) {
      toast({
        title: language === 'ar' ? 'فشل التحميل' : 'Download failed',
        description: e?.message || (language === 'ar' ? 'غير قادر على تحميل النموذج' : 'Unable to download template'),
        variant: "destructive",
      });
    }
  }

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

    if (Object.keys(fieldErrors).length > 0) {
      toast({
        title: language === 'ar' ? 'أخطاء في التحقق' : 'Validation Errors',
        description: language === 'ar' 
          ? 'يرجى تصحيح الأخطاء قبل المتابعة'
          : 'Please correct the errors before proceeding',
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
      setLastDryRunOk((response.errors?.length ?? 0) === 0);
      
      toast({
        title: language === 'ar' ? 'اكتملت المعاينة' : 'Dry Run Completed',
        description: `${response.total} rows processed, ${response.errors?.length || 0} errors found`,
      });
    } catch (err: any) {
      console.error('Dry run failed:', err);
      const msg = await extractMessage(err);

      // Try to extract debug info from error
      let debugInfo = '';
      try {
        const errorObj = JSON.parse(err.message || '{}');
        if (errorObj.debug) {
          debugInfo = `\n\nDebug Info:\n${JSON.stringify(errorObj.debug, null, 2)}`;
          console.log('🔍 Debug Info:', errorObj.debug);
        }
      } catch {}

      toast({
        title: language === 'ar' ? 'فشل في تحليل الملف' : 'Failed to parse file',
        description: msg + debugInfo,
        variant: 'destructive',
      });
      setResult(null);
      setLastDryRunOk(false);
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

    if (Object.keys(fieldErrors).length > 0) {
      toast({
        title: language === 'ar' ? 'أخطاء في التحقق' : 'Validation Errors',
        description: language === 'ar' 
          ? 'يرجى تصحيح الأخطاء قبل المتابعة'
          : 'Please correct the errors before proceeding',
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

    } catch (err: any) {
      console.error('Import failed:', err);
      const msg = await extractMessage(err);
      toast({
        title: language === 'ar' ? 'فشل في تحليل الملف' : 'Failed to parse file',
        description: msg,
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
            {language === 'ar' ? 'استيراد التنظيم' : 'Import Regulation'}
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'تحميل قالب CSV' : 'Download CSV Template'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="code">{language === 'ar' ? 'الكود' : 'Code'}</Label>
              <Input 
                id="code"
                value={code} 
                onChange={handleCodeChange} 
                placeholder="ECC / DCC / CUSTOM"
                className={fieldErrors.code ? "border-red-500" : ""}
                data-testid="input-code"
              />
              {fieldErrors.code ? (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{fieldErrors.code}</p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  {language === 'ar' 
                    ? 'استخدم كود قصير (مثال: ECC، DCC، HRPOLICY)'
                    : 'Use a short code (e.g. ECC, DCC, HRPOLICY).'
                  }
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="version">{language === 'ar' ? 'الإصدار' : 'Version'}</Label>
              <Input 
                id="version"
                value={version} 
                onChange={handleVersionChange} 
                placeholder="2024-v0.4"
                className={fieldErrors.version ? "border-red-500" : ""}
                data-testid="input-version"
              />
              {fieldErrors.version ? (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{fieldErrors.version}</p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  {language === 'ar' 
                    ? 'اتبع النمط الدلالي (مثال: 2024-v0.4)'
                    : 'Follow semantic style (e.g. 2024-v0.4).'
                  }
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="nameEn">{language === 'ar' ? 'الاسم (إنجليزي)' : 'Name (English)'}</Label>
              <Input 
                id="nameEn"
                value={nameEn} 
                onChange={handleNameEnChange}
                className={fieldErrors.nameEn ? "border-red-500" : ""}
                data-testid="input-name-en"
              />
              {fieldErrors.nameEn && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{fieldErrors.nameEn}</p>
              )}
            </div>
            <div>
              <Label htmlFor="nameAr">{language === 'ar' ? 'الاسم (عربي) — اختياري' : 'Name (Arabic) — optional'}</Label>
              <Input 
                id="nameAr"
                value={nameAr} 
                onChange={handleNameArChange} 
                dir="rtl"
                className={fieldErrors.nameAr ? "border-red-500" : ""}
                data-testid="input-name-ar"
              />
              {fieldErrors.nameAr && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{fieldErrors.nameAr}</p>
              )}
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="publisher">{language === 'ar' ? 'الناشر — اختياري' : 'Publisher — optional'}</Label>
              <Input 
                id="publisher"
                value={publisher} 
                onChange={handlePublisherChange} 
                placeholder="NCA / Custom"
                className={fieldErrors.publisher ? "border-red-500" : ""}
                data-testid="input-publisher"
              />
              {fieldErrors.publisher && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{fieldErrors.publisher}</p>
              )}
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
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  {language === 'ar'
                    ? `المحدد: ${file.name} (${(file.size/1024/1024).toFixed(1)} ميجابايت)`
                    : `Selected: ${file.name} (${(file.size/1024/1024).toFixed(1)} MB)`
                  }
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFile(null)}
                    className="h-6 w-6 p-0 ml-2 hover:bg-red-100 hover:text-red-600"
                    data-testid="button-remove-file"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  {language === 'ar'
                    ? '💡 تأكد من أن الملف يحتوي على صف رأس وصف بيانات واحد على الأقل'
                    : '💡 Make sure the file has a header row and at least one data row'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                {language === 'ar'
                  ? 'اسحب وأفلت ملف .xlsx/.csv هنا، أو اختر ملف'
                  : 'Drag & drop .xlsx/.csv here, or choose a file'
                }
                <p className="text-xs text-gray-500 mt-2">
                  {language === 'ar'
                    ? '💡 نصيحة: ابدأ بتحميل القالب أولاً'
                    : '💡 Tip: Download the template first to get started'
                  }
                </p>
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
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {loading ? '...' : (language === 'ar' ? 'استيراد' : 'Import')}
                  </Button>
                </>
              ) : (
                <Button 
                  onClick={handleImport} 
                  disabled={!file || loading}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
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

            {paginationData && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {language === 'ar'
                      ? `عرض ${paginationData.startIndex + 1}-${paginationData.endIndex} من ${paginationData.totalRows} صف`
                      : `Showing ${paginationData.startIndex + 1}-${paginationData.endIndex} of ${paginationData.totalRows} rows`
                    }
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">
                      {language === 'ar' ? 'صفوف لكل صفحة:' : 'Rows per page:'}
                    </Label>
                    <select
                      value={rowsPerPage}
                      onChange={(e) => {
                        setRowsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="border rounded px-2 py-1 text-sm"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>

                <div className="border rounded-md overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {result.sample && Object.keys(result.sample[0]).map(header => (
                          <TableHead key={header}>{header}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginationData.paginatedData.map((row, index) => (
                        <TableRow key={paginationData.startIndex + index}>
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

                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {language === 'ar'
                      ? `الصفحة ${currentPage} من ${paginationData.totalPages}`
                      : `Page ${currentPage} of ${paginationData.totalPages}`
                    }
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      {language === 'ar' ? 'السابق' : 'Previous'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(paginationData.totalPages, currentPage + 1))}
                      disabled={currentPage >= paginationData.totalPages}
                      className="flex items-center gap-1"
                    >
                      {language === 'ar' ? 'التالي' : 'Next'}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
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