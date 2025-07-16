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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { EvidenceCard } from '@/components/evidence/EvidenceCard';
import { EvidenceListRow } from '@/components/evidence/EvidenceListRow';
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
  Grid3X3,
  List,
  Folder,
  CheckCircle,
  Clock,
  Tag,
  Filter,
  SortAsc,
  SortDesc,
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
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
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

  const handleDownload = (item: any) => {
    // Create download link
    const link = document.createElement('a');
    link.href = `/api/evidence/${item.id}/download`;
    link.download = item.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const filteredAndSortedEvidence = (() => {
    let filtered = evidence?.filter((item: any) => {
      const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.fileName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = typeFilter === 'all' || 
                         (typeFilter === 'documents' && item.fileType?.includes('pdf')) ||
                         (typeFilter === 'images' && item.fileType?.startsWith('image/')) ||
                         (typeFilter === 'videos' && item.fileType?.startsWith('video/')) ||
                         (typeFilter === 'archives' && (item.fileType?.includes('zip') || item.fileType?.includes('archive')));
      
      const matchesProject = projectFilter === 'all' || 
                             (projectFilter === 'unlinked' && !item.projectId) ||
                             item.projectId?.toString() === projectFilter;
      
      return matchesSearch && matchesType && matchesProject;
    }) || [];

    // Sort the filtered results
    filtered.sort((a: any, b: any) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'name-asc':
          return a.title.localeCompare(b.title);
        case 'name-desc':
          return b.title.localeCompare(a.title);
        case 'size-asc':
          return a.fileSize - b.fileSize;
        case 'size-desc':
          return b.fileSize - a.fileSize;
        default:
          return 0;
      }
    });

    return filtered;
  })();

  if (error && isUnauthorizedError(error as Error)) {
    return null; // Will redirect to login
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header with Hero Background */}
        <div className="relative bg-gradient-to-r from-teal-600 to-teal-700 rounded-xl p-8 text-white">
          <div className="absolute inset-0 bg-black/10 rounded-xl"></div>
          <div className="relative">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold">
                  {language === 'ar' ? 'مستودع الأدلة' : 'Evidence Repository'}
                </h1>
                <p className="mt-2 text-teal-100">
                  {language === 'ar'
                    ? 'إدارة ومشاركة أدلة وملفات الامتثال بطريقة منظمة ومرئية'
                    : 'Manage and share compliance evidence and files in an organized, visual way'
                  }
                </p>
                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                      {filteredAndSortedEvidence.length} {language === 'ar' ? 'ملف' : 'Files'}
                    </Badge>
                  </div>
                </div>
              </div>

              <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-white text-teal-700 hover:bg-gray-50">
                    <Upload className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'رفع ملف جديد' : 'Upload Evidence'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{language === 'ar' ? 'رفع ملف جديد' : 'Upload Evidence'}</DialogTitle>
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
                      
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsUploadDialogOpen(false)}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={uploadEvidenceMutation.isPending || !selectedFile}
                          className="flex-1"
                        >
                          {uploadEvidenceMutation.isPending ? 'Uploading...' : 'Upload'}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder={language === 'ar' ? 'البحث في الأدلة...' : 'Search evidence...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Type Filter */}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'ar' ? 'جميع الأنواع' : 'All Types'}</SelectItem>
                  <SelectItem value="documents">{language === 'ar' ? 'المستندات' : 'Documents'}</SelectItem>
                  <SelectItem value="images">{language === 'ar' ? 'الصور' : 'Images'}</SelectItem>
                  <SelectItem value="videos">{language === 'ar' ? 'الفيديوهات' : 'Videos'}</SelectItem>
                  <SelectItem value="archives">{language === 'ar' ? 'الأرشيفات' : 'Archives'}</SelectItem>
                </SelectContent>
              </Select>

              {/* Project Filter */}
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'ar' ? 'جميع المشاريع' : 'All Projects'}</SelectItem>
                  <SelectItem value="unlinked">{language === 'ar' ? 'غير مرتبط' : 'Unlinked'}</SelectItem>
                  {projects?.map((project: any) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {language === 'ar' && project.nameAr ? project.nameAr : project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* View Controls */}
            <div className="flex items-center gap-4">
              {/* Sort */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">{language === 'ar' ? 'الأحدث' : 'Newest'}</SelectItem>
                  <SelectItem value="oldest">{language === 'ar' ? 'الأقدم' : 'Oldest'}</SelectItem>
                  <SelectItem value="name-asc">{language === 'ar' ? 'الاسم (أ-ي)' : 'Name (A-Z)'}</SelectItem>
                  <SelectItem value="name-desc">{language === 'ar' ? 'الاسم (ي-أ)' : 'Name (Z-A)'}</SelectItem>
                  <SelectItem value="size-asc">{language === 'ar' ? 'الحجم (صغير)' : 'Size (Small)'}</SelectItem>
                  <SelectItem value="size-desc">{language === 'ar' ? 'الحجم (كبير)' : 'Size (Large)'}</SelectItem>
                </SelectContent>
              </Select>

              {/* View Toggle */}
              <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <Button
                  variant={viewMode === 'card' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('card')}
                  className="px-3"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="px-3"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Evidence Display */}
        <div className="min-h-[400px]">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="p-6">
                  <Skeleton className="h-4 w-3/4 mb-4" />
                  <Skeleton className="h-4 w-1/2 mb-2" />
                  <Skeleton className="h-4 w-full mb-4" />
                  <Skeleton className="h-8 w-full" />
                </Card>
              ))}
            </div>
          ) : filteredAndSortedEvidence.length === 0 ? (
            <div className="text-center py-12">
              <Folder className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">
                {language === 'ar' ? 'لا توجد أدلة' : 'No Evidence Found'}
              </h3>
              <p className="text-gray-500 mb-6">
                {language === 'ar' 
                  ? 'لم يتم العثور على أدلة تطابق معايير البحث الخاصة بك'
                  : 'No evidence found matching your search criteria'
                }
              </p>
              <Button onClick={() => setIsUploadDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                {language === 'ar' ? 'رفع أول ملف' : 'Upload First Evidence'}
              </Button>
            </div>
          ) : (
            <div>
              {viewMode === 'card' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredAndSortedEvidence.map((item: any) => (
                    <EvidenceCard
                      key={item.id}
                      evidence={item}
                      onViewDetails={handleViewDetails}
                      onAddComment={handleAddComment}
                      onDownload={handleDownload}
                      getProjectName={getProjectName}
                      getTaskName={getTaskName}
                      getRegulationType={getRegulationType}
                      language={language}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* List Header - Hidden on mobile */}
                  <div className="hidden md:flex items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400">
                    <div className="flex-1">File</div>
                    <div className="w-48 px-4">Project/Task</div>
                    <div className="w-32 px-4 text-center">Details</div>
                    <div className="w-32 px-4 text-right">Size & Date</div>
                    <div className="w-32 text-center">Actions</div>
                  </div>
                  
                  {filteredAndSortedEvidence.map((item: any) => (
                    <EvidenceListRow
                      key={item.id}
                      evidence={item}
                      onViewDetails={handleViewDetails}
                      onAddComment={handleAddComment}
                      onDownload={handleDownload}
                      getProjectName={getProjectName}
                      getTaskName={getTaskName}
                      getRegulationType={getRegulationType}
                      language={language}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Detail Dialog */}
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {language === 'ar' ? 'تفاصيل الدليل' : 'Evidence Details'}
              </DialogTitle>
            </DialogHeader>
            {selectedEvidence && (
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  {getFileIcon(selectedEvidence.fileType)}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">
                      {language === 'ar' && selectedEvidence.titleAr ? selectedEvidence.titleAr : selectedEvidence.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      {language === 'ar' && selectedEvidence.descriptionAr ? selectedEvidence.descriptionAr : selectedEvidence.description}
                    </p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-600">File Size:</span>
                        <p>{formatFileSize(selectedEvidence.fileSize)}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Version:</span>
                        <p>v{selectedEvidence.version}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Type:</span>
                        <p>{getRegulationType(selectedEvidence)}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Uploaded:</span>
                        <p>{formatDate(selectedEvidence.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button onClick={() => handleDownload(selectedEvidence)}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  <Button variant="outline" onClick={() => handleAddComment(selectedEvidence)}>
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Add Comment
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Comment Dialog */}
        <Dialog open={isCommentDialogOpen} onOpenChange={setIsCommentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {language === 'ar' ? 'إضافة تعليق' : 'Add Comment'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                placeholder={language === 'ar' ? 'اكتب تعليقك هنا...' : 'Write your comment here...'}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCommentDialogOpen(false);
                    setComment('');
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    // Handle comment submission here
                    setIsCommentDialogOpen(false);
                    setComment('');
                  }}
                  className="flex-1"
                >
                  Add Comment
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
