import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { useI18n } from '@/hooks/use-i18n';
import { useToast } from '@/hooks/use-toast';
import { isUnauthorizedError } from '@/lib/authUtils';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  Upload, 
  Search, 
  FileText, 
  Download, 
  Calendar,
  User,
  File,
  Image,
  Video,
  Archive,
  Trash2,
  Eye,
  MessageCircle,
  Building,
  CheckCircle,
  Clock,
  Folder,
  Tag,
} from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const evidenceSchema = z.object({
  title: z.string().min(1, 'Evidence title is required'),
  titleAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  projectId: z.number().optional(),
  taskId: z.number().optional(),
  eccControlId: z.number().optional(),
  isNewVersion: z.boolean().optional(),
  parentEvidenceId: z.number().optional(),
  version: z.string().optional(),
});

type EvidenceFormData = z.infer<typeof evidenceSchema>;

export default function Evidence() {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [comment, setComment] = useState('');

  const { data: evidence, isLoading, error } = useQuery({
    queryKey: ['/api/evidence'],
    retry: false,
  });

  const { data: projects } = useQuery({
    queryKey: ['/api/projects'],
    retry: false,
  });

  const { data: tasks } = useQuery({
    queryKey: ['/api/tasks'],
    retry: false,
  });

  const { data: eccControls } = useQuery({
    queryKey: ['/api/ecc-controls'],
    retry: false,
  });

  // Helper functions
  const getProjectName = (projectId: number) => {
    const project = projects?.find((p: any) => p.id === projectId);
    return project ? (language === 'ar' && project.nameAr ? project.nameAr : project.name) : 'Unknown Project';
  };

  const getTaskName = (taskId: number) => {
    const task = tasks?.find((t: any) => t.id === taskId);
    return task ? (language === 'ar' && task.titleAr ? task.titleAr : task.title) : 'Unknown Task';
  };

  const getRegulationType = (item: any) => {
    if (item.eccControlId) {
      const control = eccControls?.find((c: any) => c.id === item.eccControlId);
      return control ? 'ECC' : 'Unknown';
    }
    if (item.projectId) {
      const project = projects?.find((p: any) => p.id === item.projectId);
      return project?.regulationType?.toUpperCase() || 'ECC';
    }
    return 'General';
  };

  const handleViewDetails = (item: any) => {
    setSelectedEvidence(item);
    setIsDetailDialogOpen(true);
  };

  const handleAddComment = (item: any) => {
    setSelectedEvidence(item);
    setIsCommentDialogOpen(true);
  };

  const uploadEvidenceMutation = useMutation({
    mutationFn: async (data: EvidenceFormData & { file: File }) => {
      const formData = new FormData();
      formData.append('file', data.file);
      formData.append('title', data.title);
      if (data.titleAr) formData.append('titleAr', data.titleAr);
      if (data.description) formData.append('description', data.description);
      if (data.descriptionAr) formData.append('descriptionAr', data.descriptionAr);
      if (data.projectId) formData.append('projectId', data.projectId.toString());
      if (data.taskId) formData.append('taskId', data.taskId.toString());
      if (data.eccControlId) formData.append('eccControlId', data.eccControlId.toString());
      if (data.isNewVersion) formData.append('isNewVersion', 'true');
      if (data.parentEvidenceId) formData.append('parentEvidenceId', data.parentEvidenceId.toString());
      if (data.version) formData.append('version', data.version);

      const response = await fetch('/api/evidence', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/evidence'] });
      setIsUploadDialogOpen(false);
      setSelectedFile(null);
      form.reset();
      toast({
        title: t('common.success'),
        description: 'Evidence uploaded successfully',
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: t('common.error'),
        description: 'Failed to upload evidence',
        variant: 'destructive',
      });
    },
  });

  const form = useForm<EvidenceFormData>({
    resolver: zodResolver(evidenceSchema),
    defaultValues: {
      title: '',
      titleAr: '',
      description: '',
      descriptionAr: '',
    },
  });

  const onSubmit = (data: EvidenceFormData) => {
    if (!selectedFile) {
      toast({
        title: t('common.error'),
        description: 'Please select a file to upload',
        variant: 'destructive',
      });
      return;
    }
    uploadEvidenceMutation.mutate({ ...data, file: selectedFile });
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="h-5 w-5 text-blue-600" />;
    } else if (fileType.startsWith('video/')) {
      return <Video className="h-5 w-5 text-purple-600" />;
    } else if (fileType.includes('pdf')) {
      return <FileText className="h-5 w-5 text-red-600" />;
    } else if (fileType.includes('zip') || fileType.includes('archive')) {
      return <Archive className="h-5 w-5 text-orange-600" />;
    } else {
      return <File className="h-5 w-5 text-slate-600" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const filteredEvidence = evidence?.filter((item: any) => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.fileName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === 'all' || 
                       (typeFilter === 'documents' && item.fileType?.includes('pdf')) ||
                       (typeFilter === 'images' && item.fileType?.startsWith('image/')) ||
                       (typeFilter === 'videos' && item.fileType?.startsWith('video/')) ||
                       (typeFilter === 'archives' && (item.fileType?.includes('zip') || item.fileType?.includes('archive')));
    
    return matchesSearch && matchesType;
  }) || [];

  if (error && isUnauthorizedError(error as Error)) {
    return null; // Will redirect to login
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              {t('nav.evidence')}
            </h1>
            <p className="text-slate-600 mt-1">
              {language === 'ar'
                ? 'إدارة ومشاركة أدلة وملفات الامتثال'
                : 'Manage and share compliance evidence and files'
              }
            </p>
          </div>

          <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-teal-600 hover:bg-teal-700">
                <Upload className="h-4 w-4 mr-2" />
                {t('actions.uploadEvidence')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t('actions.uploadEvidence')}</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {/* File Upload */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">File</label>
                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
                      <input
                        type="file"
                        onChange={handleFileChange}
                        className="hidden"
                        id="file-upload"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.mp4,.mov,.zip,.rar"
                      />
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <Upload className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                        <p className="text-sm text-slate-600 mb-2">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-slate-500">
                          PDF, DOC, XLS, PPT, Images, Videos, Archives up to 10MB
                        </p>
                      </label>
                      {selectedFile && (
                        <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center justify-center space-x-2">
                            {getFileIcon(selectedFile.type)}
                            <span className="text-sm font-medium">{selectedFile.name}</span>
                            <Badge variant="outline">
                              {formatFileSize(selectedFile.size)}
                            </Badge>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Evidence Title (English)</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="titleAr"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Evidence Title (Arabic)</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (English)</FormLabel>
                          <FormControl>
                            <Textarea {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="descriptionAr"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Arabic)</FormLabel>
                          <FormControl>
                            <Textarea {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="projectId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project (Optional)</FormLabel>
                          <Select onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a project" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {projects?.map((project: any) => (
                                <SelectItem key={project.id} value={project.id.toString()}>
                                  {project.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="taskId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Task (Optional)</FormLabel>
                          <Select onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a task" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {tasks?.map((task: any) => (
                                <SelectItem key={task.id} value={task.id.toString()}>
                                  {task.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Version Tracking Section */}
                  <div className="bg-slate-50 p-4 rounded-lg space-y-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isNewVersion"
                        checked={form.watch('isNewVersion') || false}
                        onChange={(e) => form.setValue('isNewVersion', e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="isNewVersion" className="text-sm font-medium text-slate-700">
                        {language === 'ar' ? 'رفع كإصدار جديد من دليل موجود' : 'Upload as new version of existing evidence'}
                      </label>
                    </div>

                    {form.watch('isNewVersion') && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">
                            {language === 'ar' ? 'الدليل الأصلي' : 'Original Evidence'}
                          </label>
                          <Select onValueChange={(value) => form.setValue('parentEvidenceId', value ? parseInt(value) : undefined)}>
                            <SelectTrigger>
                              <SelectValue placeholder={language === 'ar' ? 'اختر الدليل الأصلي' : 'Select original evidence'} />
                            </SelectTrigger>
                            <SelectContent>
                              {evidence?.map((item: any) => (
                                <SelectItem key={item.id} value={item.id.toString()}>
                                  {language === 'ar' && item.titleAr ? item.titleAr : item.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">
                            {language === 'ar' ? 'رقم الإصدار' : 'Version Number'}
                          </label>
                          <Input
                            placeholder={language === 'ar' ? 'مثال: v2.0, v1.1' : 'e.g., v2.0, v1.1'}
                            value={form.watch('version') || ''}
                            onChange={(e) => form.setValue('version', e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
                      {t('common.cancel')}
                    </Button>
                    <Button type="submit" disabled={uploadEvidenceMutation.isPending || !selectedFile}>
                      {uploadEvidenceMutation.isPending ? t('common.loading') : t('common.upload')}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  type="search"
                  placeholder={t('actions.search')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="documents">Documents</SelectItem>
                  <SelectItem value="images">Images</SelectItem>
                  <SelectItem value="videos">Videos</SelectItem>
                  <SelectItem value="archives">Archives</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Evidence Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            // Loading skeletons
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="glass-card">
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))
          ) : filteredEvidence.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Upload className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-600 mb-2">
                {searchTerm || typeFilter !== 'all' 
                  ? (language === 'ar' ? 'لم يتم العثور على أدلة' : 'No evidence found')
                  : (language === 'ar' ? 'لا توجد أدلة' : 'No evidence yet')
                }
              </h3>
              <p className="text-slate-500 mb-4">
                {searchTerm || typeFilter !== 'all'
                  ? (language === 'ar' ? 'جرب تغيير مرشحات البحث' : 'Try adjusting your search filters')
                  : (language === 'ar' ? 'ابدأ برفع دليلك الأول' : 'Get started by uploading your first evidence')
                }
              </p>
              {!searchTerm && typeFilter === 'all' && (
                <Button onClick={() => setIsUploadDialogOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  {t('actions.uploadEvidence')}
                </Button>
              )}
            </div>
          ) : (
            filteredEvidence.map((item: any) => (
              <Card 
                key={item.id} 
                className="hover:shadow-xl transition-all duration-300 cursor-pointer group border-l-4 border-l-[#2699A6] bg-gradient-to-br from-white to-slate-50 overflow-hidden"
                onClick={() => handleViewDetails(item)}
              >
                <CardHeader className="pb-3 bg-gradient-to-r from-[#2699A6]/5 to-transparent">
                  <div className="flex items-start space-x-3">
                    <div className="w-14 h-14 bg-gradient-to-br from-[#2699A6]/10 to-[#2699A6]/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      {getFileIcon(item.fileType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg text-slate-800 group-hover:text-[#2699A6] transition-colors mb-1">
                        {language === 'ar' && item.titleAr ? item.titleAr : item.title}
                      </h3>
                      
                      {/* Regulation and Context Badges */}
                      <div className="flex items-center flex-wrap gap-2 mb-2">
                        <Badge variant="secondary" className="text-xs bg-[#2699A6]/10 text-[#2699A6] border border-[#2699A6]/20 font-semibold">
                          {getRegulationType(item)}
                        </Badge>
                        {item.projectId && (
                          <Badge variant="outline" className="text-xs">
                            <Building className="w-3 h-3 mr-1" />
                            {getProjectName(item.projectId)}
                          </Badge>
                        )}
                        {item.taskId && (
                          <Badge variant="outline" className="text-xs">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            {getTaskName(item.taskId)}
                          </Badge>
                        )}
                      </div>
                      
                      {/* File Info Row */}
                      <div className="flex items-center space-x-3 text-sm text-slate-600">
                        <div className="flex items-center">
                          <File className="h-3 w-3 mr-1" />
                          <span className="font-medium">{formatFileSize(item.fileSize)}</span>
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          <span>{formatDate(item.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {item.description && (
                    <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 p-3 rounded-lg">
                      {language === 'ar' && item.descriptionAr 
                        ? item.descriptionAr 
                        : item.description
                      }
                    </p>
                  )}
                  
                  {/* Evidence Details Grid */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="space-y-1">
                      <span className="text-slate-500 font-medium">
                        {language === 'ar' ? 'نوع الملف' : 'File Type'}
                      </span>
                      <p className="font-semibold text-slate-800 uppercase">
                        {item.fileType || 'Unknown'}
                      </p>
                    </div>
                    
                    <div className="space-y-1">
                      <span className="text-slate-500 font-medium">
                        {language === 'ar' ? 'رفع بواسطة' : 'Uploaded By'}
                      </span>
                      <p className="font-semibold text-slate-800">
                        {item.uploadedById || 'Unknown'}
                      </p>
                    </div>
                  </div>

                  {/* Control Information */}
                  {item.eccControlId && (
                    <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-3 rounded-lg">
                      <div className="flex items-center space-x-2 mb-1">
                        <Tag className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">
                          {language === 'ar' ? 'الضابط المرتبط' : 'Related Control'}
                        </span>
                      </div>
                      <p className="text-sm text-blue-700">
                        ECC Control #{item.eccControlId}
                      </p>
                    </div>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div className="flex items-center space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="bg-[#2699A6]/5 border-[#2699A6]/20 text-[#2699A6] hover:bg-[#2699A6] hover:text-white transition-all duration-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`/api/evidence/${item.id}/download`, '_blank');
                        }}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        {t('common.download')}
                      </Button>
                      
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddComment(item);
                        }}
                      >
                        <MessageCircle className="h-3 w-3 mr-1" />
                        {language === 'ar' ? 'تعليق' : 'Comment'}
                      </Button>
                      
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="text-purple-600 border-purple-200 hover:bg-purple-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          // TODO: Implement version history view
                          toast({
                            title: language === 'ar' ? 'تاريخ الإصدارات' : 'Version History',
                            description: language === 'ar' ? 'سيتم تطوير هذه الميزة قريباً' : 'This feature will be available soon',
                          });
                        }}
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        {language === 'ar' ? 'الإصدارات' : 'Versions'}
                      </Button>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="text-[#2699A6] hover:bg-[#2699A6]/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(item);
                        }}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        {language === 'ar' ? 'عرض' : 'View'}
                      </Button>
                      
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-red-600 hover:bg-red-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Evidence Detail Dialog */}
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#2699A6]">
                {language === 'ar' ? 'تفاصيل الدليل' : 'Evidence Details'}
              </DialogTitle>
            </DialogHeader>
            
            {selectedEvidence && (
              <div className="space-y-6">
                {/* Header Section */}
                <div className="bg-gradient-to-r from-[#2699A6]/5 to-transparent p-4 rounded-lg">
                  <div className="flex items-start space-x-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-[#2699A6]/10 to-[#2699A6]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      {getFileIcon(selectedEvidence.fileType)}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-slate-800 mb-2">
                        {language === 'ar' && selectedEvidence.titleAr ? selectedEvidence.titleAr : selectedEvidence.title}
                      </h3>
                      <div className="flex items-center flex-wrap gap-2">
                        <Badge variant="secondary" className="bg-[#2699A6]/10 text-[#2699A6] border border-[#2699A6]/20">
                          {getRegulationType(selectedEvidence)}
                        </Badge>
                        <Badge variant="outline">
                          {formatFileSize(selectedEvidence.fileSize)}
                        </Badge>
                        <Badge variant="outline">
                          {selectedEvidence.fileType?.toUpperCase() || 'Unknown'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {selectedEvidence.description && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-slate-800">
                      {language === 'ar' ? 'الوصف' : 'Description'}
                    </h4>
                    <p className="text-slate-600 bg-slate-50 p-3 rounded-lg leading-relaxed">
                      {language === 'ar' && selectedEvidence.descriptionAr 
                        ? selectedEvidence.descriptionAr 
                        : selectedEvidence.description
                      }
                    </p>
                  </div>
                )}

                {/* Project & Task Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedEvidence.projectId && (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <Building className="h-5 w-5 text-blue-600" />
                        <h4 className="font-semibold text-blue-800">
                          {language === 'ar' ? 'المشروع' : 'Project'}
                        </h4>
                      </div>
                      <p className="text-blue-700 font-medium">
                        {getProjectName(selectedEvidence.projectId)}
                      </p>
                    </div>
                  )}

                  {selectedEvidence.taskId && (
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <h4 className="font-semibold text-green-800">
                          {language === 'ar' ? 'المهمة' : 'Task'}
                        </h4>
                      </div>
                      <p className="text-green-700 font-medium">
                        {getTaskName(selectedEvidence.taskId)}
                      </p>
                    </div>
                  )}
                </div>

                {/* ECC Control Information */}
                {selectedEvidence.eccControlId && (
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <Tag className="h-5 w-5 text-purple-600" />
                      <h4 className="font-semibold text-purple-800">
                        {language === 'ar' ? 'ضابط الامتثال المرتبط' : 'Related Compliance Control'}
                      </h4>
                    </div>
                    <p className="text-purple-700 font-medium">
                      ECC Control #{selectedEvidence.eccControlId}
                    </p>
                  </div>
                )}

                {/* File Information */}
                <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                  <h4 className="font-semibold text-slate-800">
                    {language === 'ar' ? 'معلومات الملف' : 'File Information'}
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500 font-medium">
                        {language === 'ar' ? 'اسم الملف' : 'File Name'}:
                      </span>
                      <p className="font-semibold text-slate-800">{selectedEvidence.fileName}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">
                        {language === 'ar' ? 'تاريخ الرفع' : 'Upload Date'}:
                      </span>
                      <p className="font-semibold text-slate-800">{formatDate(selectedEvidence.createdAt)}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">
                        {language === 'ar' ? 'رفع بواسطة' : 'Uploaded By'}:
                      </span>
                      <p className="font-semibold text-slate-800">{selectedEvidence.uploadedById}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">
                        {language === 'ar' ? 'حجم الملف' : 'File Size'}:
                      </span>
                      <p className="font-semibold text-slate-800">{formatFileSize(selectedEvidence.fileSize)}</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                  <div className="flex items-center space-x-3">
                    <Button 
                      className="bg-[#2699A6] hover:bg-[#2699A6]/90 text-white"
                      onClick={() => window.open(`/api/evidence/${selectedEvidence.id}/download`, '_blank')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {language === 'ar' ? 'تحميل الملف' : 'Download File'}
                    </Button>
                    
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setIsDetailDialogOpen(false);
                        handleAddComment(selectedEvidence);
                      }}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      {language === 'ar' ? 'إضافة تعليق' : 'Add Comment'}
                    </Button>
                    
                    <Button 
                      variant="outline"
                      className="text-purple-600 border-purple-200 hover:bg-purple-50"
                      onClick={() => {
                        setIsDetailDialogOpen(false);
                        form.setValue('isNewVersion', true);
                        form.setValue('parentEvidenceId', selectedEvidence.id);
                        form.setValue('title', selectedEvidence.title);
                        form.setValue('titleAr', selectedEvidence.titleAr || '');
                        form.setValue('description', selectedEvidence.description || '');
                        form.setValue('descriptionAr', selectedEvidence.descriptionAr || '');
                        form.setValue('projectId', selectedEvidence.projectId);
                        form.setValue('taskId', selectedEvidence.taskId);
                        form.setValue('eccControlId', selectedEvidence.eccControlId);
                        setIsUploadDialogOpen(true);
                      }}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {language === 'ar' ? 'إصدار جديد' : 'New Version'}
                    </Button>
                  </div>
                  
                  <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
                    {language === 'ar' ? 'إغلاق' : 'Close'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Comment Dialog */}
        <Dialog open={isCommentDialogOpen} onOpenChange={setIsCommentDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {language === 'ar' ? 'إضافة تعليق' : 'Add Comment'}
              </DialogTitle>
            </DialogHeader>
            
            {selectedEvidence && (
              <div className="space-y-4">
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-slate-800">
                    {language === 'ar' ? 'الدليل:' : 'Evidence:'} {language === 'ar' && selectedEvidence.titleAr ? selectedEvidence.titleAr : selectedEvidence.title}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    {language === 'ar' ? 'التعليق' : 'Comment'}
                  </label>
                  <Textarea
                    placeholder={language === 'ar' ? 'أدخل تعليقك هنا...' : 'Enter your comment here...'}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                  />
                </div>
                
                <div className="flex items-center justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsCommentDialogOpen(false)}>
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </Button>
                  <Button 
                    className="bg-[#2699A6] hover:bg-[#2699A6]/90 text-white"
                    onClick={() => {
                      // Here you would save the comment
                      toast({
                        title: t('common.success'),
                        description: language === 'ar' ? 'تم حفظ التعليق' : 'Comment saved successfully',
                      });
                      setComment('');
                      setIsCommentDialogOpen(false);
                    }}
                  >
                    {language === 'ar' ? 'حفظ التعليق' : 'Save Comment'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
