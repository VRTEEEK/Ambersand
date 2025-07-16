import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useI18n } from '@/hooks/use-i18n';
import { 
  FileText, 
  MessageSquare, 
  History, 
  Upload,
  Download,
  Calendar,
  User,
  X
} from 'lucide-react';

interface ControlInfoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  control: any;
  projectId: number;
}

export function ControlInfoDialog({ 
  isOpen, 
  onClose, 
  control,
  projectId 
}: ControlInfoDialogProps) {
  const { t, language } = useI18n();
  const [activeTab, setActiveTab] = useState('info');

  // Fetch evidence linked to this control
  const { data: linkedEvidence, isLoading: evidenceLoading } = useQuery({
    queryKey: ['/api/controls', control?.id, 'evidence'],
    queryFn: async () => {
      if (!control?.id) return [];
      const response = await fetch(`/api/controls/${control.id}/evidence`);
      if (!response.ok) throw new Error('Failed to fetch control evidence');
      return response.json();
    },
    enabled: !!control?.id && isOpen,
  });

  if (!control) return null;

  const getRequiredEvidence = () => {
    if (language === 'ar') {
      return control.evidenceAr || control.requirementAr || 'وثائق، سياسات، إجراءات، وأدلة تدقيق';
    }
    return control.evidenceEn || control.requirementEn || 'Documentation, policies, procedures, and audit evidence';
  };

  const getControlDescription = () => {
    if (language === 'ar') {
      return control.controlAr || control.subdomainAr;
    }
    return control.controlEn || control.subdomainEn;
  };

  const getDomainName = () => {
    if (language === 'ar') {
      return control.domainAr;
    }
    return control.domainEn;
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const formData = new FormData();
    formData.append('file', files[0]);
    formData.append('projectId', projectId.toString());
    formData.append('title', files[0].name);
    formData.append('description', `Evidence file: ${files[0].name}`);
    
    try {
      const response = await fetch('/api/evidence', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const evidence = await response.json();
        
        // Link the evidence to this control
        await fetch(`/api/evidence/${evidence.id}/controls`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ controlIds: [control.id] }),
        });
        
        // Refresh the evidence list
        window.location.reload();
      }
    } catch (error) {
      console.error('Error uploading evidence:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Badge variant="secondary" className="text-sm font-mono">
                  {control.code}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {getDomainName()}
                </Badge>
              </div>
              <DialogTitle className="text-xl font-semibold leading-tight">
                {getControlDescription()}
              </DialogTitle>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onClose}
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {language === 'ar' ? 'معلومات الضابط' : 'Control Info'}
            </TabsTrigger>
            <TabsTrigger value="evidence" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              {language === 'ar' ? 'الأدلة المرتبطة' : 'Linked Evidence'}
              {linkedEvidence?.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 text-xs">
                  {linkedEvidence.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              {language === 'ar' ? 'رفع أدلة' : 'Upload Evidence'}
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[calc(90vh-200px)] mt-4">
            <TabsContent value="info" className="space-y-4 mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {language === 'ar' ? 'وصف الضابط' : 'Control Description'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    {getControlDescription()}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {language === 'ar' ? 'الأدلة المطلوبة' : 'Required Evidence'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    {getRequiredEvidence().split('\n').map((line, index) => (
                      line.trim() && (
                        <p key={index} className="text-gray-700 dark:text-gray-300 mb-2">
                          {line.trim()}
                        </p>
                      )
                    ))}
                  </div>
                </CardContent>
              </Card>

              {control.implementationGuidanceEn && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {language === 'ar' ? 'إرشادات التنفيذ' : 'Implementation Guidance'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {language === 'ar' ? control.implementationGuidanceAr : control.implementationGuidanceEn}
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="evidence" className="space-y-4 mt-0">
              {evidenceLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <p className="mt-2 text-sm text-gray-500">
                    {language === 'ar' ? 'جاري تحميل الأدلة...' : 'Loading evidence...'}
                  </p>
                </div>
              ) : linkedEvidence && linkedEvidence.length > 0 ? (
                <div className="space-y-4">
                  {linkedEvidence.map((evidence: any) => (
                    <Card key={evidence.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <CardTitle className="text-base font-medium">
                                {evidence.title}
                              </CardTitle>
                              <Badge variant="secondary" className="text-xs">
                                v{evidence.version}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {evidence.description}
                            </p>
                          </div>
                          <Button size="sm" variant="outline">
                            <Download className="h-4 w-4 mr-1" />
                            {language === 'ar' ? 'تحميل' : 'Download'}
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {evidence.fileName}
                          </span>
                          <span>{(evidence.fileSize / 1024).toFixed(1)} KB</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(evidence.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        
                        {evidence.versions && evidence.versions.length > 0 && (
                          <div className="mb-3">
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                              <History className="h-4 w-4" />
                              {language === 'ar' ? 'سجل الإصدارات' : 'Version History'}
                            </h4>
                            <div className="space-y-1">
                              {evidence.versions.map((version: any) => (
                                <div key={version.id} className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded">
                                  <span>v{version.version}</span>
                                  <span>{new Date(version.createdAt).toLocaleDateString()}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {evidence.comments && evidence.comments.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                              <MessageSquare className="h-4 w-4" />
                              {language === 'ar' ? 'التعليقات' : 'Comments'}
                            </h4>
                            <div className="space-y-2">
                              {evidence.comments.map((comment: any) => (
                                <div key={comment.id} className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                                  <div className="flex items-center gap-2 mb-1">
                                    <User className="h-3 w-3" />
                                    <span className="text-xs font-medium">
                                      {comment.user?.firstName} {comment.user?.lastName || comment.user?.email}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {new Date(comment.createdAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-700 dark:text-gray-300">
                                    {comment.comment}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">
                      {language === 'ar' ? 'لا توجد أدلة مرتبطة بهذا الضابط' : 'No evidence linked to this control'}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      {language === 'ar' ? 'استخدم تبويب "رفع أدلة" لإضافة ملفات جديدة' : 'Use the "Upload Evidence" tab to add new files'}
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="upload" className="space-y-4 mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {language === 'ar' ? 'رفع أدلة جديدة' : 'Upload New Evidence'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                    <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">
                      {language === 'ar' ? 'اسحب وأفلت الملفات هنا' : 'Drag and drop files here'}
                    </h3>
                    <p className="text-gray-500 mb-4">
                      {language === 'ar' ? 'أو انقر لتحديد الملفات' : 'Or click to select files'}
                    </p>
                    <input
                      type="file"
                      onChange={(e) => handleFileUpload(e.target.files)}
                      className="hidden"
                      id="evidence-upload"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                    />
                    <Button asChild>
                      <label htmlFor="evidence-upload" className="cursor-pointer">
                        {language === 'ar' ? 'اختر ملف' : 'Choose File'}
                      </label>
                    </Button>
                    <p className="text-xs text-gray-400 mt-2">
                      {language === 'ar' ? 'يدعم: PDF, DOC, DOCX, JPG, PNG, XLS, XLSX' : 'Supports: PDF, DOC, DOCX, JPG, PNG, XLS, XLSX'}
                    </p>
                  </div>
                  
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                      {language === 'ar' ? 'الأدلة المطلوبة لهذا الضابط:' : 'Required evidence for this control:'}
                    </h4>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      {getRequiredEvidence()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}