import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Plus, X } from 'lucide-react';

interface CreateProjectBarProps {
  count: number;
  onClear: () => void;
  onCreate: (name: string, desc?: string) => void;
  language: 'en' | 'ar';
}

export function CreateProjectBar({ count, onClear, onCreate, language }: CreateProjectBarProps) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [desc, setDesc] = React.useState('');

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate(name.trim(), desc.trim() || undefined);
    setOpen(false);
    setName('');
    setDesc('');
  };

  return (
    <>
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40" data-testid="bar-create-project">
        <Card className="shadow-lg border">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" data-testid="badge-selected-count">
                  {count}
                </Badge>
                <span className="text-sm font-medium" data-testid="text-selected-label">
                  {language === 'ar' ? 'ضابط محدد' : 'selected'}
                </span>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onClear}
                  data-testid="button-clear"
                >
                  <X className="h-4 w-4 mr-1" />
                  {language === 'ar' ? 'مسح' : 'Clear'}
                </Button>
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-teal-600 hover:bg-teal-700" data-testid="button-create-project">
                      <Plus className="h-4 w-4 mr-1" />
                      {language === 'ar' ? 'إنشاء مشروع' : 'Create Project'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent data-testid="dialog-create-project">
                    <DialogHeader>
                      <DialogTitle data-testid="text-dialog-title">
                        {language === 'ar' ? 'إنشاء مشروع امتثال' : 'Create Compliance Project'}
                      </DialogTitle>
                      <DialogDescription data-testid="text-dialog-description">
                        {language === 'ar' 
                          ? `إنشاء مشروع امتثال جديد مع ${count} ضابط محدد`
                          : `Create a new compliance project with ${count} selected controls`
                        }
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium" data-testid="label-project-name">
                          {language === 'ar' ? 'اسم المشروع' : 'Project Name'} *
                        </label>
                        <Input
                          placeholder={language === 'ar' ? 'مشروع الامتثال الجديد' : 'New Compliance Project'}
                          value={name}
                          onChange={e => setName(e.target.value)}
                          className="mt-1"
                          data-testid="input-project-name"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium" data-testid="label-project-description">
                          {language === 'ar' ? 'الوصف (اختياري)' : 'Description (optional)'}
                        </label>
                        <Textarea
                          placeholder={language === 'ar' ? 'وصف المشروع...' : 'Project description...'}
                          value={desc}
                          onChange={e => setDesc(e.target.value)}
                          className="mt-1"
                          rows={3}
                          data-testid="textarea-project-description"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-4">
                        <Button 
                          variant="outline" 
                          onClick={() => setOpen(false)}
                          data-testid="button-cancel"
                        >
                          {language === 'ar' ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button
                          onClick={handleCreate}
                          disabled={!name.trim()}
                          className="bg-teal-600 hover:bg-teal-700"
                          data-testid="button-confirm-create"
                        >
                          {language === 'ar' ? 'إنشاء' : 'Create'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}