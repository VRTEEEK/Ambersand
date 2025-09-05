import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/hooks/use-i18n";
import { createProject } from "@/lib/api/projects";
import { Plus, X } from "lucide-react";

interface ProjectCreateDialogProps {
  regulationId: number;
  selectedControlIds: number[];
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ProjectCreateDialog({
  regulationId,
  selectedControlIds,
  open,
  onClose,
  onSuccess,
}: ProjectCreateDialogProps) {
  const { language } = useI18n();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: (data: any) => createProject({
      name: data.name,
      description: data.description,
      regulationId,
      controlIds: selectedControlIds,
    }),
    onSuccess: (response) => {
      toast({
        title: language === 'ar' ? 'تم إنشاء المشروع' : 'Project Created',
        description: language === 'ar' 
          ? 'تم إنشاء المشروع بنجاح مع الضوابط المحددة'
          : 'Project created successfully with selected controls',
      });
      
      // Navigate to the new project
      navigate(`/projects/${response.projectId}`);
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' 
          ? 'فشل في إنشاء المشروع'
          : 'Failed to create project',
        variant: 'destructive',
      });
    },
  });

  // Handle form submission
  const handleCreate = () => {
    if (!formData.name.trim()) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' 
          ? 'اسم المشروع مطلوب'
          : 'Project name is required',
        variant: 'destructive',
      });
      return;
    }

    if (selectedControlIds.length === 0) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' 
          ? 'يجب تحديد ضابط واحد على الأقل'
          : 'At least one control must be selected',
        variant: 'destructive',
      });
      return;
    }

    createProjectMutation.mutate(formData);
  };

  // Reset form when dialog closes
  const handleClose = () => {
    setFormData({ name: "", description: "" });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {language === 'ar' ? 'إنشاء مشروع من الضوابط المحددة' : 'Create Project from Selected Controls'}
          </DialogTitle>
          <DialogDescription>
            {language === 'ar' 
              ? 'إنشاء مشروع جديد يتضمن الضوابط المحددة للمتابعة والتنفيذ'
              : 'Create a new project including the selected controls for tracking and implementation'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selected Controls Summary */}
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">
                {language === 'ar' 
                  ? `${selectedControlIds.length} ضابط محدد`
                  : `${selectedControlIds.length} controls selected`
                }
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {language === 'ar' 
                ? 'سيتم إنشاء المشروع مع جميع الضوابط المحددة'
                : 'The project will be created with all selected controls'
              }
            </p>
          </div>

          {/* Project Name */}
          <div>
            <Label htmlFor="projectName">
              {language === 'ar' ? 'اسم المشروع *' : 'Project Name *'}
            </Label>
            <Input
              id="projectName"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder={language === 'ar' 
                ? 'أدخل اسم المشروع'
                : 'Enter project name'
              }
              disabled={createProjectMutation.isPending}
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
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              placeholder={language === 'ar' 
                ? 'أدخل وصف المشروع (اختياري)'
                : 'Enter project description (optional)'
              }
              disabled={createProjectMutation.isPending}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={createProjectMutation.isPending}
            >
              <X className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            
            <Button
              onClick={handleCreate}
              disabled={createProjectMutation.isPending || !formData.name.trim()}
            >
              <Plus className="h-4 w-4 mr-2" />
              {createProjectMutation.isPending 
                ? (language === 'ar' ? 'إنشاء...' : 'Creating...')
                : (language === 'ar' ? 'إنشاء المشروع' : 'Create Project')
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}