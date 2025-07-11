import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
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
});

type EvidenceFormData = z.infer<typeof evidenceSchema>;

export default function Evidence() {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
              <Card key={item.id} className="glass-card hover-lift">
                <CardHeader>
                  <div className="flex items-start space-x-3">
                    <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      {getFileIcon(item.fileType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-800 truncate">
                        {language === 'ar' && item.titleAr ? item.titleAr : item.title}
                      </h3>
                      <p className="text-sm text-slate-500 truncate">
                        {item.fileName}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {formatFileSize(item.fileSize)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {item.description && (
                    <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                      {language === 'ar' && item.descriptionAr 
                        ? item.descriptionAr 
                        : item.description
                      }
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between text-sm text-slate-500 mb-3">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {formatDate(item.createdAt)}
                    </div>
                    <div className="flex items-center">
                      <User className="h-4 w-4 mr-1" />
                      {item.uploadedById}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => window.open(`/api/evidence/${item.id}/download`, '_blank')}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      {t('common.download')}
                    </Button>
                    
                    <Button size="sm" variant="ghost" className="text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
