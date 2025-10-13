import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Download, FileText, FileSpreadsheet, Archive, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

const exportSchema = z.object({
  projectId: z.number(),
  regulationCode: z.string().optional(),
  formats: z.object({
    pdf: z.boolean(),
    docx: z.boolean(),
    xlsx: z.boolean()
  }).refine(data => data.pdf || data.docx || data.xlsx, {
    message: "Select at least one export format"
  }),
  evidenceMode: z.enum(['attach', 'link', 'both']).default('both'),
  controlStatus: z.enum(['all', 'approved', 'unapproved']).default('all'),
  language: z.enum(['en', 'ar']).default('en')
});

type ExportFormData = z.infer<typeof exportSchema>;

interface ExportComplianceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  projectName: string;
  regulationCode?: string;
}

export function ExportComplianceDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  regulationCode
}: ExportComplianceDialogProps) {
  const { toast } = useToast();
  const [downloadInProgress, setDownloadInProgress] = useState(false);
  
  const form = useForm<ExportFormData>({
    resolver: zodResolver(exportSchema),
    defaultValues: {
      projectId,
      regulationCode: regulationCode || 'ecc',
      formats: {
        pdf: false,
        docx: false,
        xlsx: false
      },
      evidenceMode: 'both',
      controlStatus: 'all',
      language: 'en'
    }
  });

  const exportMutation = useMutation({
    mutationFn: async (data: ExportFormData) => {
      const token = localStorage.getItem('accessToken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/reports/compliance/export`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Export failed');
      }

      // Handle file download
      const contentDisposition = response.headers.get('content-disposition');
      const filename = contentDisposition 
        ? contentDisposition.split('filename="')[1]?.split('"')[0]
        : `${projectName}_Compliance_Report.pdf`;

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      return { filename };
    },
    onSuccess: (data) => {
      toast({
        title: "Export Successful",
        description: `Report "${data.filename}" has been downloaded successfully.`,
      });
      setDownloadInProgress(false);
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Export Failed",
        description: error.message,
        variant: "destructive"
      });
      setDownloadInProgress(false);
    }
  });

  const onSubmit = (data: ExportFormData) => {
    setDownloadInProgress(true);
    exportMutation.mutate(data);
  };

  const formats = form.watch('formats');
  const selectedFormatCount = Object.values(formats).filter(Boolean).length;
  const evidenceMode = form.watch('evidenceMode');
  const willCreateZip = selectedFormatCount > 1 || evidenceMode === 'attach' || evidenceMode === 'both';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Compliance Report
          </DialogTitle>
          <DialogDescription>
            Generate and download compliance reports in multiple formats with evidence files.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              {/* Project Info */}
              <div className="rounded-lg border p-4 bg-muted/50">
                <h3 className="font-medium text-sm mb-2">Project Details</h3>
                <p className="text-sm text-muted-foreground">
                  <strong>Project:</strong> {projectName}
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Regulation:</strong> {regulationCode?.toUpperCase() || 'ECC'}
                </p>
              </div>

              {/* Export Formats */}
              <FormField
                control={form.control}
                name="formats"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Export Formats</FormLabel>
                    <FormDescription>
                      Select one or more formats for your compliance report
                    </FormDescription>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex items-center space-x-2 p-3 border rounded-lg">
                        <Checkbox
                          id="pdf"
                          checked={field.value.pdf}
                          onCheckedChange={(checked) =>
                            field.onChange({
                              ...field.value,
                              pdf: checked as boolean
                            })
                          }
                        />
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-red-600" />
                          <Label htmlFor="pdf" className="text-sm font-medium">
                            PDF Report
                          </Label>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 p-3 border rounded-lg">
                        <Checkbox
                          id="docx"
                          checked={field.value.docx}
                          onCheckedChange={(checked) =>
                            field.onChange({
                              ...field.value,
                              docx: checked as boolean
                            })
                          }
                        />
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-600" />
                          <Label htmlFor="docx" className="text-sm font-medium">
                            DOCX Report
                          </Label>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 p-3 border rounded-lg">
                        <Checkbox
                          id="xlsx"
                          checked={field.value.xlsx}
                          onCheckedChange={(checked) =>
                            field.onChange({
                              ...field.value,
                              xlsx: checked as boolean
                            })
                          }
                        />
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4 text-green-600" />
                          <Label htmlFor="xlsx" className="text-sm font-medium">
                            XLSX Spreadsheet
                          </Label>
                        </div>
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Evidence Mode */}
              <FormField
                control={form.control}
                name="evidenceMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Evidence Files</FormLabel>
                    <FormDescription>
                      Choose how to handle evidence files in the export
                    </FormDescription>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="grid grid-cols-3 gap-4"
                      >
                        <div className="flex items-center space-x-2 p-3 border rounded-lg">
                          <RadioGroupItem value="link" id="link" />
                          <Label htmlFor="link" className="text-sm">Link only</Label>
                        </div>
                        <div className="flex items-center space-x-2 p-3 border rounded-lg">
                          <RadioGroupItem value="attach" id="attach" />
                          <Label htmlFor="attach" className="text-sm">Attach files</Label>
                        </div>
                        <div className="flex items-center space-x-2 p-3 border rounded-lg">
                          <RadioGroupItem value="both" id="both" />
                          <Label htmlFor="both" className="text-sm">Link + Attach</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                {/* Control Status Filter */}
                <FormField
                  control={form.control}
                  name="controlStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Controls to Include</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select controls" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">All Controls</SelectItem>
                          <SelectItem value="approved">Completed Only</SelectItem>
                          <SelectItem value="unapproved">Pending & In-Progress</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Language */}
                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Report Language</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="ar">Arabic</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Export Summary */}
              {selectedFormatCount > 0 && (
                <div className="rounded-lg border p-4 bg-blue-50 dark:bg-blue-950/20">
                  <div className="flex items-center gap-2 mb-2">
                    {willCreateZip && <Archive className="h-4 w-4" />}
                    <h4 className="font-medium text-sm">Export Summary</h4>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {formats.pdf && <li>• PDF report with formatted compliance data</li>}
                    {formats.docx && <li>• DOCX document for editing and collaboration</li>}
                    {formats.xlsx && <li>• XLSX spreadsheet with tabular data</li>}
                    {evidenceMode === 'attach' && <li>• Evidence files attached to ZIP bundle</li>}
                    {evidenceMode === 'both' && <li>• Evidence files + links included</li>}
                    {willCreateZip && (
                      <li className="font-medium">
                        → Download: ZIP bundle with {selectedFormatCount} format{selectedFormatCount > 1 ? 's' : ''}
                        {(evidenceMode === 'attach' || evidenceMode === 'both') && ' + evidence files'}
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={downloadInProgress}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={selectedFormatCount === 0 || downloadInProgress}
              >
                {downloadInProgress ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Export Report
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}