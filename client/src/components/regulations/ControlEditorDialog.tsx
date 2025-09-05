import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { patchControl } from "@/lib/api/regulations";
import { Save, X } from "lucide-react";

interface Control {
  id: number;
  clause: string;
  mainCategoryEn: string;
  mainCategoryAr?: string;
  subCategoryEn: string;
  subCategoryAr?: string;
  mainControlEn: string;
  mainControlAr?: string;
  subControlEn?: string;
  subControlAr?: string;
  descriptionEn: string;
  descriptionAr?: string;
  evidenceTypes?: string;
  weight: number;
}

interface ControlEditorDialogProps {
  control: Control;
  regulationId: number;
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function ControlEditorDialog({
  control,
  regulationId,
  open,
  onClose,
  onSave,
}: ControlEditorDialogProps) {
  const { language } = useI18n();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    descriptionEn: "",
    descriptionAr: "",
    evidenceTypes: "",
    weight: 1.0,
  });

  // Initialize form data when control changes
  useEffect(() => {
    if (control) {
      setFormData({
        descriptionEn: control.descriptionEn || "",
        descriptionAr: control.descriptionAr || "",
        evidenceTypes: control.evidenceTypes || "",
        weight: control.weight || 1.0,
      });
    }
  }, [control]);

  // Save control mutation
  const saveControlMutation = useMutation({
    mutationFn: (data: any) => patchControl(regulationId, control.id, data),
    onSuccess: () => {
      toast({
        title: language === 'ar' ? 'تم الحفظ' : 'Saved',
        description: language === 'ar' ? 'تم حفظ تغييرات الضابط بنجاح' : 'Control changes saved successfully',
      });
      onSave();
    },
    onError: (error: any) => {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في حفظ التغييرات' : 'Failed to save changes',
        variant: 'destructive',
      });
    },
  });

  // Handle form submission
  const handleSave = () => {
    // Parse evidence types (split by $ and clean up)
    const evidenceTypesArray = formData.evidenceTypes
      .split('$')
      .map(type => type.trim())
      .filter(type => type.length > 0);
    
    const updateData = {
      descriptionEn: formData.descriptionEn,
      descriptionAr: formData.descriptionAr,
      evidenceTypes: evidenceTypesArray.join('$'),
      weight: Number(formData.weight),
    };

    saveControlMutation.mutate(updateData);
  };

  // Parse evidence types for display as badges
  const evidenceTypesArray = formData.evidenceTypes
    .split('$')
    .map(type => type.trim())
    .filter(type => type.length > 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>
            {language === 'ar' ? 'تحرير الضابط' : 'Edit Control'}
          </DialogTitle>
          <DialogDescription>
            {language === 'ar' 
              ? 'تحرير خصائص الضابط وأنواع الأدلة المطلوبة'
              : 'Edit control properties and required evidence types'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Control Info (Read-only) */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">{control.clause}</Badge>
              <h4 className="font-medium">
                {language === 'ar' ? control.mainControlAr || control.mainControlEn : control.mainControlEn}
              </h4>
            </div>
            
            {control.subControlEn && (
              <p className="text-sm text-muted-foreground">
                {language === 'ar' ? control.subControlAr || control.subControlEn : control.subControlEn}
              </p>
            )}
            
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span>
                {language === 'ar' ? 'المجال:' : 'Domain:'} {language === 'ar' ? control.mainCategoryAr || control.mainCategoryEn : control.mainCategoryEn}
              </span>
              <span>
                {language === 'ar' ? 'المجال الفرعي:' : 'Subdomain:'} {language === 'ar' ? control.subCategoryAr || control.subCategoryEn : control.subCategoryEn}
              </span>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Description EN */}
            <div>
              <Label htmlFor="descriptionEn">
                {language === 'ar' ? 'الوصف (إنجليزي)' : 'Description (English)'}
              </Label>
              <Textarea
                id="descriptionEn"
                value={formData.descriptionEn}
                onChange={e => setFormData(prev => ({ ...prev, descriptionEn: e.target.value }))}
                rows={3}
                placeholder={language === 'ar' ? 'أدخل وصف الضابط باللغة الإنجليزية' : 'Enter control description in English'}
              />
            </div>

            {/* Description AR */}
            <div>
              <Label htmlFor="descriptionAr">
                {language === 'ar' ? 'الوصف (عربي)' : 'Description (Arabic)'}
              </Label>
              <Textarea
                id="descriptionAr"
                value={formData.descriptionAr}
                onChange={e => setFormData(prev => ({ ...prev, descriptionAr: e.target.value }))}
                rows={3}
                dir="rtl"
                placeholder={language === 'ar' ? 'أدخل وصف الضابط باللغة العربية' : 'Enter control description in Arabic'}
              />
            </div>

            {/* Evidence Types */}
            <div>
              <Label htmlFor="evidenceTypes">
                {language === 'ar' ? 'أنواع الأدلة' : 'Evidence Types'}
              </Label>
              <Input
                id="evidenceTypes"
                value={formData.evidenceTypes}
                onChange={e => setFormData(prev => ({ ...prev, evidenceTypes: e.target.value }))}
                placeholder={language === 'ar' 
                  ? 'اكتب أنواع الأدلة مفصولة بـ $' 
                  : 'Enter evidence types separated by $'
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                {language === 'ar' 
                  ? 'مثال: وثيقة السياسة $ محضر الاجتماع $ تقرير التدقيق' 
                  : 'Example: Policy Document $ Meeting Minutes $ Audit Report'
                }
              </p>
              
              {/* Evidence Types Preview */}
              {evidenceTypesArray.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {evidenceTypesArray.map((type, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {type}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Weight */}
            <div>
              <Label htmlFor="weight">
                {language === 'ar' ? 'الوزن' : 'Weight'}
              </Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={formData.weight}
                onChange={e => setFormData(prev => ({ ...prev, weight: parseFloat(e.target.value) || 0 }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {language === 'ar' 
                  ? 'وزن الضابط في التقييم (0.1 - 10.0)' 
                  : 'Control weight in assessment (0.1 - 10.0)'
                }
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={saveControlMutation.isPending}
            >
              <X className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            
            <Button
              onClick={handleSave}
              disabled={saveControlMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {saveControlMutation.isPending 
                ? (language === 'ar' ? 'حفظ...' : 'Saving...')
                : (language === 'ar' ? 'حفظ التغييرات' : 'Save Changes')
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}