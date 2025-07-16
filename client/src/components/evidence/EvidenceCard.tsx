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

interface EvidenceCardProps {
  evidence: any;
  onViewDetails: (evidence: any) => void;
  onAddComment: (evidence: any) => void;
  onDownload: (evidence: any) => void;
  getProjectName: (projectId: number) => string;
  getTaskName: (taskId: number) => string;
  getRegulationType: (evidence: any) => string;
  getControlInfo?: (controlId: number) => { code: string; codeAr: string; controlEn: string; controlAr: string; } | null;
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
              {controlInfo && (
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="secondary" className="text-xs px-2 py-1 bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100">
                      <Shield className="h-3 w-3 mr-1" />
                      {language === 'ar' ? controlInfo.codeAr : controlInfo.code}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-medium mb-1">
                      {language === 'ar' ? controlInfo.codeAr : controlInfo.code}
                    </p>
                    <p className="text-sm">
                      {language === 'ar' ? controlInfo.controlAr : controlInfo.controlEn}
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

        {/* Description */}
        {evidence.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
            {language === 'ar' && evidence.descriptionAr ? evidence.descriptionAr : evidence.description}
          </p>
        )}

        {/* Metadata */}
        <div className="space-y-2 mb-4">
          {/* File Size & Type */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{formatFileSize(evidence.fileSize)}</span>
            <Badge variant="secondary" className="text-xs">
              {getRegulationType(evidence)}
            </Badge>
          </div>

          {/* Project & Task */}
          {evidence.projectId && (
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <Building className="h-3 w-3" />
              <span className="truncate">{getProjectName(evidence.projectId)}</span>
            </div>
          )}
          
          {evidence.taskId && (
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <CheckCircle className="h-3 w-3" />
              <span className="truncate">{getTaskName(evidence.taskId)}</span>
            </div>
          )}

          {/* Upload Date & Uploader */}
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Calendar className="h-3 w-3" />
            <span>{formatDate(evidence.createdAt)}</span>
          </div>
          
          {evidence.uploaderName && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <User className="h-3 w-3" />
              <span className="truncate">
                {language === 'ar' ? 'رفع بواسطة' : 'Uploaded by'} {evidence.uploaderName}
              </span>
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