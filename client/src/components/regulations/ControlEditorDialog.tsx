import { useState, useEffect } from "react";
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
import { Save, X, Plus } from "lucide-react";

interface Control {
  id: number;
  clause?: string;
  code?: string;
  
  // Unified regulation control fields
  mainCategoryEn?: string;
  mainCategoryAr?: string;
  subCategoryEn?: string;
  subCategoryAr?: string;
  mainControlEn?: string;
  mainControlAr?: string;
  subControlEn?: string;
  subControlAr?: string;
  descriptionEn?: string;
  descriptionAr?: string;
  evidenceTypes?: string;
  weight?: number;
  
  // Custom regulation control fields
  mainDomain?: string;
  mainDomainAr?: string;
  subDomain?: string;
  subDomainAr?: string;
  control?: string;
  controlAr?: string;
  subControl?: string;
  description?: string;
  evidenceRequired?: boolean;
  evidenceNote?: string;
  evidenceNoteAr?: string;
}

interface ControlEditorDialogProps {
  control: Control;
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  isLoading?: boolean;
}

export function ControlEditorDialog({
  control,
  open,
  onClose,
  onSave,
  isLoading = false,
}: ControlEditorDialogProps) {
  const { language } = useI18n();

  const [formData, setFormData] = useState({
    // Domain/Category fields (supports both unified and custom formats)
    mainCategoryEn: "",
    mainCategoryAr: "",
    subCategoryEn: "",
    subCategoryAr: "",
    
    // Control content fields
    mainControlEn: "",
    mainControlAr: "",
    subControlEn: "",
    subControlAr: "",
    
    // Description fields
    descriptionEn: "",
    descriptionAr: "",
    
    // Evidence and weight
    evidenceTypes: "",
    weight: 1.0,
  });

  const [evidenceChips, setEvidenceChips] = useState<string[]>([]);
  const [newEvidenceType, setNewEvidenceType] = useState("");

  // Initialize form data when control changes
  useEffect(() => {
    if (control) {
      setFormData({
        // Handle both unified (mainCategoryEn) and custom (mainDomain) field names
        mainCategoryEn: control.mainCategoryEn || control.mainDomain || "",
        mainCategoryAr: control.mainCategoryAr || control.mainDomainAr || "",
        subCategoryEn: control.subCategoryEn || control.subDomain || "",
        subCategoryAr: control.subCategoryAr || control.subDomainAr || "",
        
        mainControlEn: control.mainControlEn || control.control || "",
        mainControlAr: control.mainControlAr || control.controlAr || "",
        subControlEn: control.subControlEn || control.subControl || "",
        subControlAr: control.subControlAr || "",
        
        descriptionEn: control.descriptionEn || control.description || "",
        descriptionAr: control.descriptionAr || "",
        
        evidenceTypes: control.evidenceTypes || "",
        weight: control.weight || 1.0,
      });

      // Parse evidence types into chips (split by $ as specified)
      if (control.evidenceTypes) {
        setEvidenceChips(control.evidenceTypes.split('$').filter(Boolean));
      } else {
        setEvidenceChips([]);
      }
    }
  }, [control]);

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addEvidenceType = () => {
    if (newEvidenceType.trim()) {
      setEvidenceChips(prev => [...prev, newEvidenceType.trim()]);
      setNewEvidenceType("");
    }
  };

  const removeEvidenceType = (index: number) => {
    setEvidenceChips(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    // Prepare data with evidence types joined by $
    const saveData = {
      ...formData,
      evidenceTypes: evidenceChips.join('$'),
    };
    onSave(saveData);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.target === document.activeElement) {
      e.preventDefault();
      addEvidenceType();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Control</DialogTitle>
          <DialogDescription>
            Edit control details including domain, subdomain, content, and evidence requirements.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Domain/Category Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Domain/Category</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="mainCategoryEn">Main Category (English)</Label>
                <Input
                  id="mainCategoryEn"
                  value={formData.mainCategoryEn}
                  onChange={(e) => handleInputChange("mainCategoryEn", e.target.value)}
                  placeholder="Enter main category in English"
                />
              </div>
              <div>
                <Label htmlFor="mainCategoryAr">Main Category (Arabic)</Label>
                <Input
                  id="mainCategoryAr"
                  value={formData.mainCategoryAr}
                  onChange={(e) => handleInputChange("mainCategoryAr", e.target.value)}
                  placeholder="أدخل الفئة الرئيسية بالعربية"
                  dir="rtl"
                />
              </div>
              <div>
                <Label htmlFor="subCategoryEn">Sub Category (English)</Label>
                <Input
                  id="subCategoryEn"
                  value={formData.subCategoryEn}
                  onChange={(e) => handleInputChange("subCategoryEn", e.target.value)}
                  placeholder="Enter sub category in English"
                />
              </div>
              <div>
                <Label htmlFor="subCategoryAr">Sub Category (Arabic)</Label>
                <Input
                  id="subCategoryAr"
                  value={formData.subCategoryAr}
                  onChange={(e) => handleInputChange("subCategoryAr", e.target.value)}
                  placeholder="أدخل الفئة الفرعية بالعربية"
                  dir="rtl"
                />
              </div>
            </div>
          </div>

          {/* Control Content Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Control Content</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="mainControlEn">Main Control (English)</Label>
                <Textarea
                  id="mainControlEn"
                  value={formData.mainControlEn}
                  onChange={(e) => handleInputChange("mainControlEn", e.target.value)}
                  placeholder="Enter main control text in English"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="mainControlAr">Main Control (Arabic)</Label>
                <Textarea
                  id="mainControlAr"
                  value={formData.mainControlAr}
                  onChange={(e) => handleInputChange("mainControlAr", e.target.value)}
                  placeholder="أدخل نص التحكم الرئيسي بالعربية"
                  dir="rtl"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="subControlEn">Sub Control (English)</Label>
                <Textarea
                  id="subControlEn"
                  value={formData.subControlEn}
                  onChange={(e) => handleInputChange("subControlEn", e.target.value)}
                  placeholder="Enter sub control text in English (optional)"
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="subControlAr">Sub Control (Arabic)</Label>
                <Textarea
                  id="subControlAr"
                  value={formData.subControlAr}
                  onChange={(e) => handleInputChange("subControlAr", e.target.value)}
                  placeholder="أدخل نص التحكم الفرعي بالعربية (اختياري)"
                  dir="rtl"
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Description</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="descriptionEn">Description (English)</Label>
                <Textarea
                  id="descriptionEn"
                  value={formData.descriptionEn}
                  onChange={(e) => handleInputChange("descriptionEn", e.target.value)}
                  placeholder="Enter detailed description in English"
                  rows={4}
                />
              </div>
              <div>
                <Label htmlFor="descriptionAr">Description (Arabic)</Label>
                <Textarea
                  id="descriptionAr"
                  value={formData.descriptionAr}
                  onChange={(e) => handleInputChange("descriptionAr", e.target.value)}
                  placeholder="أدخل الوصف التفصيلي بالعربية"
                  dir="rtl"
                  rows={4}
                />
              </div>
            </div>
          </div>

          {/* Evidence Types Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Evidence Types</h3>
            
            {/* Evidence Chips */}
            <div className="flex flex-wrap gap-2">
              {evidenceChips.map((type, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  {type}
                  <button
                    type="button"
                    onClick={() => removeEvidenceType(index)}
                    className="hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>

            {/* Add New Evidence Type */}
            <div className="flex gap-2">
              <Input
                value={newEvidenceType}
                onChange={(e) => setNewEvidenceType(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Add evidence type (e.g., 'Policy Document', 'Audit Report')"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={addEvidenceType}
                disabled={!newEvidenceType.trim()}
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </div>

          {/* Weight Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Control Weight</h3>
            <div className="w-full md:w-48">
              <Label htmlFor="weight">Weight (Importance)</Label>
              <Input
                id="weight"
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={formData.weight}
                onChange={(e) => handleInputChange("weight", parseFloat(e.target.value) || 0)}
                placeholder="1.0"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-6 border-t">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}