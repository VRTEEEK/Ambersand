import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  FileText, 
  Download, 
  Calendar,
  User,
  File,
  Image,
  Video,
  Archive,
  Eye,
  MessageCircle,
  Building,
  Tag,
  CheckCircle,
  Clock,
  Shield,
} from 'lucide-react';
import { UserAvatar } from '@/components/ui/user-avatar';

interface EvidenceCardProps {
  evidence: any;
  onViewDetails: (evidence: any) => void;
  onAddComment: (evidence: any) => void;
  onDownload: (evidence: any) => void;
  getProjectName: (projectId: number) => string;
  getTaskName: (taskId: number) => string;
  getRegulationType: (evidence: any) => string;
  getControlInfo?: (controlId: number) => { 
    code: string; 
    codeAr: string; 
    controlEn: string; 
    controlAr: string;
    domainEn: string;
    domainAr: string;
    subdomainEn: string;
    subdomainAr: string;
  } | null;
  language: string;
}

export function EvidenceCard({ 
  evidence, 
  onViewDetails, 
  onAddComment, 
  onDownload,
  getProjectName,
  getTaskName,
  getRegulationType,
  getControlInfo,
  language 
}: EvidenceCardProps) {
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

  const controlInfo = evidence.eccControlId && getControlInfo ? getControlInfo(evidence.eccControlId) : null;

  return (
    <TooltipProvider>
      <Card className="hover:shadow-lg transition-shadow duration-200 group">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {getFileIcon(evidence.fileType)}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                  {language === 'ar' && evidence.titleAr ? evidence.titleAr : evidence.title}
                </h3>
                <p className="text-sm text-gray-500 truncate">
                  {evidence.fileName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-2">
              <Badge variant="outline">
                v{evidence.version}
              </Badge>
            </div>
          </div>

        {/* Metadata */}
        <div className="space-y-3 mb-4">
          {/* File Size & Type */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{formatFileSize(evidence.fileSize)}</span>
            <Badge variant="secondary" className="text-xs">
              {getRegulationType(evidence)}
            </Badge>
          </div>

          {/* Linked Items Grid */}
          {(evidence.projectId || evidence.taskId || controlInfo) && (
            <div className="grid grid-cols-3 gap-4">
              {/* Control Column */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-600">
                  {language === 'ar' ? 'الضابط:' : 'Control:'}
                </div>
                {controlInfo ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Badge variant="outline" className="text-xs bg-teal-50 text-teal-700 border-teal-200 w-full justify-start cursor-help">
                          <Shield className="h-3 w-3 mr-1" />
                          <span className="truncate">{language === 'ar' ? controlInfo.codeAr : controlInfo.code}</span>
                        </Badge>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-md p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                          <Shield className="h-4 w-4 text-teal-600" />
                          <span className="font-semibold text-sm text-gray-900 dark:text-white">
                            {language === 'ar' ? controlInfo.codeAr : controlInfo.code}
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                              {language === 'ar' ? 'النطاق:' : 'Domain:'}
                            </span>
                            <p className="text-xs text-gray-800 dark:text-gray-200 mt-1">
                              {language === 'ar' ? controlInfo.domainAr : controlInfo.domainEn}
                            </p>
                          </div>
                          
                          <div>
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                              {language === 'ar' ? 'النطاق الفرعي:' : 'Subdomain:'}
                            </span>
                            <p className="text-xs text-gray-800 dark:text-gray-200 mt-1">
                              {language === 'ar' ? controlInfo.subdomainAr : controlInfo.subdomainEn}
                            </p>
                          </div>
                          
                          <div>
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                              {language === 'ar' ? 'وصف الضابط:' : 'Control Description:'}
                            </span>
                            <p className="text-xs text-gray-800 dark:text-gray-200 mt-1 leading-relaxed">
                              {language === 'ar' ? controlInfo.controlAr : controlInfo.controlEn}
                            </p>
                          </div>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <div className="text-xs text-gray-400">
                    {language === 'ar' ? 'غير محدد' : 'Not set'}
                  </div>
                )}
              </div>

              {/* Project Column */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-600">
                  {language === 'ar' ? 'المشروع:' : 'Project:'}
                </div>
                {evidence.projectId ? (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 w-full justify-start">
                    <Building className="h-3 w-3 mr-1" />
                    <span className="truncate">{getProjectName(evidence.projectId)}</span>
                  </Badge>
                ) : (
                  <div className="text-xs text-gray-400">
                    {language === 'ar' ? 'غير محدد' : 'Not set'}
                  </div>
                )}
              </div>

              {/* Task Column */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-600">
                  {language === 'ar' ? 'المهمة:' : 'Task:'}
                </div>
                {evidence.taskId ? (
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 w-full justify-start">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    <span className="truncate">{getTaskName(evidence.taskId)}</span>
                  </Badge>
                ) : (
                  <div className="text-xs text-gray-400">
                    {language === 'ar' ? 'غير محدد' : 'Not set'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Upload Date */}
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Calendar className="h-3 w-3" />
            <span>{formatDate(evidence.createdAt)}</span>
          </div>
          
          {/* Uploader with Avatar */}
          {evidence.uploaderName && (
            <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 dark:bg-gray-800 p-2 rounded-lg">
              <UserAvatar 
                user={{
                  name: evidence.uploaderName,
                  email: evidence.uploaderEmail || '',
                  profilePicture: evidence.uploaderProfilePicture
                }}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{evidence.uploaderName}</div>
                <div className="text-xs text-gray-500">
                  {language === 'ar' ? 'رفع بواسطة' : 'Uploaded by'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-4 border-t border-gray-100 dark:border-gray-700">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onViewDetails(evidence)}
            className="flex-1"
          >
            <Eye className="h-3 w-3 mr-1" />
            {language === 'ar' ? 'عرض' : 'View'}
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDownload(evidence)}
          >
            <Download className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
    </TooltipProvider>
  );
}