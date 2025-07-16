import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';

interface EvidenceListRowProps {
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

export function EvidenceListRow({ 
  evidence, 
  onViewDetails, 
  onAddComment, 
  onDownload,
  getProjectName,
  getTaskName,
  getRegulationType,
  getControlInfo,
  language 
}: EvidenceListRowProps) {
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="h-4 w-4 text-blue-600" />;
    } else if (fileType.startsWith('video/')) {
      return <Video className="h-4 w-4 text-purple-600" />;
    } else if (fileType.includes('pdf')) {
      return <FileText className="h-4 w-4 text-red-600" />;
    } else if (fileType.includes('zip') || fileType.includes('archive')) {
      return <Archive className="h-4 w-4 text-orange-600" />;
    } else {
      return <File className="h-4 w-4 text-slate-600" />;
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

  return (
    <div className="flex items-center p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow duration-200">
      {/* File Icon & Basic Info */}
      <div className="flex items-center space-x-4 flex-1 min-w-0">
        <div className="flex-shrink-0">
          {getFileIcon(evidence.fileType)}
        </div>
        
        {/* Title & Filename */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 dark:text-white truncate">
            {language === 'ar' && evidence.titleAr ? evidence.titleAr : evidence.title}
          </h3>
          <p className="text-sm text-gray-500 truncate">
            {evidence.fileName}
          </p>
        </div>
      </div>

      {/* Project/Task Info - Hidden on mobile */}
      <div className="hidden md:flex flex-col items-start space-y-1 w-48 px-4">
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
        {!evidence.projectId && !evidence.taskId && (
          <span className="text-xs text-gray-400">
            {language === 'ar' ? 'غير مرتبط' : 'Not linked'}
          </span>
        )}
      </div>

      {/* Metadata - Hidden on mobile */}
      <div className="hidden lg:flex flex-col items-center space-y-1 w-32 px-4">
        <Badge variant="outline" className="text-xs">
          v{evidence.version}
        </Badge>
        <Badge variant="secondary" className="text-xs">
          {getRegulationType(evidence)}
        </Badge>
      </div>

      {/* File Size & Date - Hidden on mobile */}
      <div className="hidden md:flex flex-col items-end space-y-1 w-32 px-4">
        <span className="text-xs text-gray-600">
          {formatFileSize(evidence.fileSize)}
        </span>
        <span className="text-xs text-gray-500">
          {formatDate(evidence.createdAt)}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 ml-4">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onViewDetails(evidence)}
          className="px-2"
        >
          <Eye className="h-3 w-3" />
          <span className="hidden sm:inline ml-1">
            {language === 'ar' ? 'عرض' : 'View'}
          </span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onAddComment(evidence)}
          className="px-2"
        >
          <MessageCircle className="h-3 w-3" />
          <span className="hidden sm:inline ml-1">
            {language === 'ar' ? 'تعليق' : 'Comment'}
          </span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onDownload(evidence)}
          className="px-2"
        >
          <Download className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}