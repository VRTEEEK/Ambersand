import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getComplianceReportData } from '../services/reportData';
import { renderComplianceHTML } from '../services/html';
import { buildPDF, buildDOCX, buildXLSX, streamBundle } from '../services/reportBuilders';
import { requireExportReports } from '../rbac-middleware';

const router = Router();

const exportRequestSchema = z.object({
  projectId: z.number(),
  regulationCode: z.string().optional(),
  formats: z.object({
    pdf: z.boolean(),
    docx: z.boolean(),
    xlsx: z.boolean()
  }).refine(data => data.pdf || data.docx || data.xlsx, {
    message: "At least one format must be selected"
  }),
  evidenceMode: z.enum(['attach', 'link', 'both']).default('both'),
  controlStatus: z.union([
    z.literal('all'),
    z.literal('approved'),
    z.literal('unapproved'),
    z.object({ in: z.array(z.string()) })
  ]).optional().default('all'),
  language: z.enum(['en', 'ar']).default('en')
});

router.post('/compliance/export', requireExportReports(), async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = exportRequestSchema.parse(req.body);
    const { projectId, regulationCode, formats, evidenceMode, controlStatus, language } = validatedData;
    
    // Get user organization for tenant scoping
    const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
    const { storage } = await import('../storage');
    const currentUser = await storage.getUser(userId);
    const organizationId = currentUser?.organizationId;
    
    if (!organizationId) {
      return res.status(403).json({ message: "Organization access required" });
    }
    
    // Get report data
    const report = await getComplianceReportData({
      projectId,
      regulationCode,
      controlStatusFilter: controlStatus,
      organizationId
    });
    
    // Generate HTML content for PDF
    const htmlContent = renderComplianceHTML(report, language);
    
    // Count formats selected
    const selectedFormats = Object.values(formats).filter(Boolean).length;
    const hasEvidence = evidenceMode === 'attach' || evidenceMode === 'both';
    
    // If multiple formats or evidence attachments needed, create ZIP bundle
    if (selectedFormats > 1 || hasEvidence) {
      await streamBundle({
        report,
        formats,
        includeEvidence: evidenceMode,
        res,
        htmlContent
      });
    } else {
      // Single format without evidence - send directly
      let buffer: Buffer;
      let contentType: string;
      let fileName: string;
      
      if (formats.pdf) {
        buffer = await buildPDF(htmlContent);
        contentType = 'application/pdf';
        fileName = `Compliance_Report_${report.project.name}.pdf`;
      } else if (formats.docx) {
        buffer = await buildDOCX(report);
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        fileName = `Compliance_Report_${report.project.name}.docx`;
      } else if (formats.xlsx) {
        buffer = await buildXLSX(report);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileName = `Compliance_Report_${report.project.name}.xlsx`;
      } else {
        return res.status(400).json({ message: "No valid format selected" });
      }
      
      res.set({
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`
      });
      
      res.send(buffer);
    }
    
  } catch (error) {
    console.error('Export error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: "Invalid request parameters",
        errors: error.errors 
      });
    }
    
    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json({ message: error.message });
      }
    }
    
    res.status(500).json({ message: "Failed to generate report" });
  }
});

export default router;