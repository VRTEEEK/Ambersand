import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, Download, X, ZoomIn, ZoomOut } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface FilePreviewProps {
  fileName: string;
  fileType: string;
  filePath?: string;
  fileSize?: number;
  onDownload?: () => void;
  language: string;
  trigger?: React.ReactNode;
  showInline?: boolean;
}

export function FilePreview({ 
  fileName, 
  fileType, 
  filePath, 
  fileSize,
  onDownload,
  language,
  trigger,
  showInline = false
}: FilePreviewProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [zoom, setZoom] = useState(100);

  const isImage = fileType.startsWith('image/');
  const isPdf = fileType.includes('pdf');
  const isPreviewable = isImage || isPdf;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileUrl = () => {
    if (!filePath) return '';
    // Handle both full paths and just filenames
    const filename = filePath.includes('/') ? filePath.split('/').pop() : filePath;
    return `/uploads/${filename}`;
  };

  const PreviewContent = () => {
    const fileUrl = getFileUrl();
    
    if (!isPreviewable || !fileUrl) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{language === 'ar' ? 'معاينة غير متوفرة' : 'Preview not available'}</p>
            <p className="text-sm text-gray-400">
              {language === 'ar' ? 'هذا النوع من الملفات لا يدعم المعاينة' : 'This file type does not support preview'}
            </p>
          </div>
        </div>
      );
    }

    if (isImage) {
      return (
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {language === 'ar' ? 'صورة' : 'Image'}
              </Badge>
              <span className="text-sm text-gray-500">{formatFileSize(fileSize || 0)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setZoom(Math.max(25, zoom - 25))}
                disabled={zoom <= 25}
              >
                <ZoomOut className="h-3 w-3" />
              </Button>
              <span className="text-sm text-gray-600 min-w-[60px] text-center">{zoom}%</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setZoom(Math.min(200, zoom + 25))}
                disabled={zoom >= 200}
              >
                <ZoomIn className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="max-h-96 overflow-auto border rounded-lg bg-gray-50 dark:bg-gray-900 p-4">
            <img
              src={fileUrl}
              alt={fileName}
              className="mx-auto max-w-full"
              style={{ width: `${zoom}%` }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0iY2VudHJhbCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzk5YTNhZiI+SW1hZ2UgTm90IEZvdW5kPC90ZXh0Pjwvc3ZnPg==';
              }}
            />
          </div>
        </div>
      );
    }

    if (isPdf) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                PDF
              </Badge>
              <span className="text-sm text-gray-500">{formatFileSize(fileSize || 0)}</span>
            </div>
          </div>
          <div className="border rounded-lg bg-gray-50 dark:bg-gray-900">
            <iframe
              src={fileUrl}
              className="w-full h-96 rounded-lg"
              title={fileName}
              onError={() => {
                console.log('PDF preview failed, falling back to download option');
              }}
            />
          </div>
          <div className="text-center text-sm text-gray-500">
            {language === 'ar' 
              ? 'إذا لم تظهر المعاينة، يمكنك تحميل الملف مباشرة'
              : 'If preview doesn\'t load, you can download the file directly'}
          </div>
        </div>
      );
    }

    return null;
  };

  const PreviewTooltip = () => {
    if (!isPreviewable) return null;

    const fileUrl = getFileUrl();
    if (!fileUrl) return null;

    if (isImage) {
      return (
        <TooltipContent side="top" className="p-2 max-w-xs">
          <img
            src={fileUrl}
            alt={fileName}
            className="max-w-full max-h-32 rounded"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
          <p className="text-xs mt-1 text-center">{fileName}</p>
        </TooltipContent>
      );
    }

    if (isPdf) {
      return (
        <TooltipContent side="top" className="p-3">
          <div className="text-center">
            <div className="w-16 h-20 bg-red-100 rounded flex items-center justify-center mb-2">
              <span className="text-red-600 font-bold text-xs">PDF</span>
            </div>
            <p className="text-xs">{fileName}</p>
            <p className="text-xs text-gray-500 mt-1">
              {language === 'ar' ? 'انقر للمعاينة' : 'Click to preview'}
            </p>
          </div>
        </TooltipContent>
      );
    }

    return null;
  };

  if (showInline) {
    return (
      <div className="w-full">
        <PreviewContent />
      </div>
    );
  }

  const defaultTrigger = (
    <Button size="sm" variant="outline">
      <Eye className="h-3 w-3 mr-1" />
      {language === 'ar' ? 'معاينة' : 'Preview'}
    </Button>
  );

  return (
    <TooltipProvider>
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              {trigger || defaultTrigger}
            </DialogTrigger>
          </TooltipTrigger>
          {isPreviewable && <PreviewTooltip />}
        </Tooltip>

        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold">
                {language === 'ar' ? 'معاينة الملف' : 'File Preview'}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {onDownload && (
                  <Button size="sm" variant="outline" onClick={onDownload}>
                    <Download className="h-3 w-3 mr-1" />
                    {language === 'ar' ? 'تحميل' : 'Download'}
                  </Button>
                )}
              </div>
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {fileName}
            </div>
          </DialogHeader>
          
          <div className="overflow-auto max-h-[calc(90vh-120px)]">
            <PreviewContent />
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}