import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/hooks/use-i18n";
import { Plus, X } from "lucide-react";

interface ProjectCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; description?: string }) => void;
  isLoading?: boolean;
  selectedControlsCount: number;
}

export function ProjectCreateDialog({
  open,
  onClose,
  onSave,
  isLoading = false,
  selectedControlsCount,
}: ProjectCreateDialogProps) {
  const { language } = useI18n();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name.trim()) {
      onSave({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      });
    }
  };

  const handleClose = () => {
    setFormData({ name: "", description: "" });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {language === 'ar' ? 'إنشاء مشروع جديد' : 'Create New Project'}
          </DialogTitle>
          <DialogDescription>
            {language === 'ar' 
              ? `إنشاء مشروع جديد باستخدام ${selectedControlsCount} ضابط محدد`
              : `Create a new project with ${selectedControlsCount} selected control${selectedControlsCount !== 1 ? 's' : ''}`
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project Name */}
          <div>
            <Label htmlFor="projectName">
              {language === 'ar' ? 'اسم المشروع' : 'Project Name'} *
            </Label>
            <Input
              id="projectName"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder={language === 'ar' ? 'أدخل اسم المشروع' : 'Enter project name'}
              required
              disabled={isLoading}
              dir={language === 'ar' ? 'rtl' : 'ltr'}
            />
          </div>

          {/* Project Description */}
          <div>
            <Label htmlFor="projectDescription">
              {language === 'ar' ? 'وصف المشروع' : 'Project Description'}
            </Label>
            <Textarea
              id="projectDescription"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder={language === 'ar' 
                ? 'أدخل وصف المشروع (اختياري)'
                : 'Enter project description (optional)'
              }
              rows={3}
              disabled={isLoading}
              dir={language === 'ar' ? 'rtl' : 'ltr'}
            />
          </div>

          {/* Selected Controls Summary */}
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {language === 'ar' ? 'الضوابط المحددة:' : 'Selected Controls:'}
              </span>
              <Badge variant="secondary">
                {selectedControlsCount} {language === 'ar' ? 'ضابط' : 'control(s)'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {language === 'ar' 
                ? 'سيتم إنشاء المشروع مع جميع الضوابط المحددة'
                : 'Project will be created with all selected controls'
              }
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose} 
              disabled={isLoading}
            >
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || !formData.name.trim()}
            >
              <Plus className="h-4 w-4 mr-2" />
              {isLoading 
                ? (language === 'ar' ? 'جاري الإنشاء...' : 'Creating...') 
                : (language === 'ar' ? 'إنشاء المشروع' : 'Create Project')
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}