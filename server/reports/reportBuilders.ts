import puppeteer from 'puppeteer';
import { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } from 'docx';
import ExcelJS from 'exceljs';
import archiver from 'archiver';
import sanitizeFilename from 'sanitize-filename';
import { ComplianceReport } from './reportData';
import { createReadStream, existsSync } from 'fs';
import { Response } from 'express';

export async function buildPDF(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  });
  
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '16mm',
        bottom: '16mm',
        left: '12mm',
        right: '12mm'
      }
    });
    
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

export async function buildDOCX(report: ComplianceReport): Promise<Buffer> {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // Title page
        new Paragraph({
          text: `Compliance Report - ${report.project.name}`,
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({
          text: report.regulation.name,
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({
          text: `Generated on ${new Date(report.generatedAt).toLocaleDateString()}`,
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({ text: "" }), // Line break
        
        // Summary section
        new Paragraph({
          text: "Compliance Summary",
          heading: HeadingLevel.HEADING_1
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Total Controls")] }),
                new TableCell({ children: [new Paragraph(report.totals.controls.toString())] }),
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Approved Controls")] }),
                new TableCell({ children: [new Paragraph(report.totals.approved.toString())] }),
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Pending Controls")] }),
                new TableCell({ children: [new Paragraph(report.totals.pending.toString())] }),
              ]
            })
          ]
        }),
        
        new Paragraph({ text: "" }), // Line break
        
        // Controls by domain
        new Paragraph({
          text: "Control Details",
          heading: HeadingLevel.HEADING_1
        }),
        
        ...generateDOCXControlsByDomain(report.controls)
      ]
    }]
  });
  
  return await Packer.toBuffer(doc);
}

function generateDOCXControlsByDomain(controls: ComplianceReport['controls']): any[] {
  const domains = Array.from(new Set(controls.map(c => c.domain)));
  const elements: any[] = [];
  
  domains.forEach(domain => {
    const domainControls = controls.filter(c => c.domain === domain);
    
    elements.push(
      new Paragraph({
        text: domain,
        heading: HeadingLevel.HEADING_2
      })
    );
    
    domainControls.forEach(control => {
      elements.push(
        new Paragraph({
          text: `${control.code}: ${control.title}`,
          heading: HeadingLevel.HEADING_3
        }),
        new Paragraph({
          text: `Status: ${control.status}`
        })
      );
      
      if (control.evidence.length > 0) {
        elements.push(
          new Paragraph({
            text: "Evidence:",
            heading: HeadingLevel.HEADING_4
          })
        );
        
        control.evidence.forEach(ev => {
          elements.push(
            new Paragraph({
              text: `• ${ev.title} (${ev.fileName})`
            })
          );
          if (ev.description) {
            elements.push(
              new Paragraph({
                text: `  ${ev.description}`
              })
            );
          }
        });
      }
      
      elements.push(new Paragraph({ text: "" })); // Spacing
    });
  });
  
  return elements;
}

export async function buildXLSX(report: ComplianceReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  
  // Overview sheet
  const overviewSheet = workbook.addWorksheet('Overview');
  overviewSheet.columns = [
    { header: 'Metric', key: 'metric', width: 25 },
    { header: 'Value', key: 'value', width: 15 }
  ];
  
  overviewSheet.addRows([
    { metric: 'Project Name', value: report.project.name },
    { metric: 'Regulation', value: report.regulation.name },
    { metric: 'Generated Date', value: new Date(report.generatedAt).toLocaleDateString() },
    { metric: '', value: '' }, // Empty row
    { metric: 'Total Controls', value: report.totals.controls },
    { metric: 'Approved Controls', value: report.totals.approved },
    { metric: 'Pending Controls', value: report.totals.pending },
    { metric: 'In Progress Controls', value: report.totals.inProgress },
    { metric: 'Under Review Controls', value: report.totals.review },
    { metric: 'Blocked Controls', value: report.totals.blocked }
  ]);
  
  // Style the overview sheet
  overviewSheet.getRow(1).font = { bold: true };
  overviewSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5F3F6' } };
  
  // Controls sheet
  const controlsSheet = workbook.addWorksheet('Controls');
  controlsSheet.columns = [
    { header: 'Code', key: 'code', width: 15 },
    { header: 'Domain', key: 'domain', width: 25 },
    { header: 'Title', key: 'title', width: 40 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Evidence Count', key: 'evidenceCount', width: 15 },
    { header: 'Last Updated', key: 'updatedAt', width: 20 }
  ];
  
  report.controls.forEach(control => {
    controlsSheet.addRow({
      code: control.code,
      domain: control.domain,
      title: control.title,
      status: control.status,
      evidenceCount: control.evidence.length,
      updatedAt: control.updatedAt ? new Date(control.updatedAt).toLocaleDateString() : ''
    });
  });
  
  // Style the controls sheet
  controlsSheet.getRow(1).font = { bold: true };
  controlsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5F3F6' } };
  controlsSheet.autoFilter = 'A1:F1';
  
  // Evidence Index sheet
  const evidenceSheet = workbook.addWorksheet('Evidence Index');
  evidenceSheet.columns = [
    { header: 'Control Code', key: 'controlCode', width: 15 },
    { header: 'Evidence Title', key: 'title', width: 30 },
    { header: 'File Name', key: 'fileName', width: 25 },
    { header: 'File Type', key: 'fileType', width: 15 },
    { header: 'Size (KB)', key: 'sizeKB', width: 15 },
    { header: 'Description', key: 'description', width: 40 }
  ];
  
  report.controls.forEach(control => {
    control.evidence.forEach(ev => {
      evidenceSheet.addRow({
        controlCode: control.code,
        title: ev.title,
        fileName: ev.fileName,
        fileType: ev.fileType || '',
        sizeKB: ev.fileSize ? Math.round(ev.fileSize / 1024) : '',
        description: ev.description || ''
      });
    });
  });
  
  // Style the evidence sheet
  evidenceSheet.getRow(1).font = { bold: true };
  evidenceSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5F3F6' } };
  evidenceSheet.autoFilter = 'A1:F1';
  
  return await workbook.xlsx.writeBuffer() as Buffer;
}

export async function streamBundle(params: {
  report: ComplianceReport;
  formats: { pdf: boolean; docx: boolean; xlsx: boolean };
  includeEvidence: 'attach' | 'link' | 'both';
  res: Response;
  htmlContent: string;
}): Promise<void> {
  const { report, formats, includeEvidence, res, htmlContent } = params;
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  const safeProjectName = sanitizeFilename(report.project.name);
  const zipName = `Ambersand_Compliance_Report_${safeProjectName}.zip`;
  
  // Set response headers
  res.set({
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${zipName}"`
  });
  
  // Pipe archive to response
  archive.pipe(res);
  
  try {
    // Add report files
    if (formats.pdf) {
      const pdfBuffer = await buildPDF(htmlContent);
      archive.append(pdfBuffer, { name: 'reports/Report.pdf' });
    }
    
    if (formats.docx) {
      const docxBuffer = await buildDOCX(report);
      archive.append(docxBuffer, { name: 'reports/Report.docx' });
    }
    
    if (formats.xlsx) {
      const xlsxBuffer = await buildXLSX(report);
      archive.append(xlsxBuffer, { name: 'reports/Report.xlsx' });
    }
    
    // Add evidence files if requested
    if (includeEvidence === 'attach' || includeEvidence === 'both') {
      for (const control of report.controls) {
        for (const ev of control.evidence) {
          if (existsSync(ev.filePath)) {
            const safeFileName = sanitizeFilename(`${control.code}__${ev.fileName}`);
            console.log(`📎 Adding evidence file: ${ev.fileName} -> evidence/${safeFileName}`);
            console.log(`📂 Source path: ${ev.filePath}`);
            archive.append(createReadStream(ev.filePath), { name: `evidence/${safeFileName}` });
          } else {
            console.log(`❌ Evidence file not found: ${ev.fileName} at ${ev.filePath}`);
            // Add placeholder for missing files
            const placeholder = `Evidence file not found: ${ev.fileName}\nControl: ${control.code}\nOriginal path: ${ev.filePath}\nGenerated at: ${new Date().toISOString()}`;
            archive.append(Buffer.from(placeholder), { name: `evidence/${control.code}__${ev.fileName}.missing.txt` });
          }
        }
      }
      
      // Add auditor index.html
      const indexHtml = generateAuditorIndex(report);
      archive.append(Buffer.from(indexHtml), { name: 'index.html' });
    }
    
    await archive.finalize();
  } catch (error) {
    console.error('Error creating bundle:', error);
    throw error;
  }
}

function generateAuditorIndex(report: ComplianceReport): string {
  const evidenceList = report.controls.flatMap(control => 
    control.evidence.map(ev => ({
      controlCode: control.code,
      controlTitle: control.title,
      evidenceTitle: ev.title,
      fileName: ev.fileName,
      fileType: ev.fileType || 'unknown',
      sizeKB: ev.fileSize ? Math.round(ev.fileSize / 1024) : 0,
      description: ev.description || '',
      safeFileName: sanitizeFilename(`${control.code}__${ev.fileName}`)
    }))
  );
  
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Compliance Evidence Index</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #2699A6; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .controls { margin-bottom: 20px; }
        .controls button { margin-right: 10px; padding: 10px 15px; background: #2699A6; color: white; border: none; border-radius: 4px; cursor: pointer; }
        .controls input { padding: 8px; margin-right: 10px; border: 1px solid #ddd; border-radius: 4px; width: 300px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px 12px; text-align: left; border: 1px solid #ddd; }
        th { background: #f8f9fa; position: sticky; top: 0; }
        .evidence-link { color: #2699A6; text-decoration: none; font-weight: bold; }
        .evidence-link:hover { text-decoration: underline; }
        .status-completed { background: #dcfce7; }
        .status-pending { background: #f3f4f6; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Compliance Evidence Browser</h1>
        <p>Project: ${report.project.name} | Regulation: ${report.regulation.name}</p>
        <p>Generated: ${new Date(report.generatedAt).toLocaleString()}</p>
    </div>
    
    <div class="controls">
        <button onclick="window.open('reports/Report.pdf', '_blank')">📄 Open Report (PDF)</button>
        <button onclick="window.open('reports/Report.docx', '_blank')">📝 Open Report (Word)</button>
        <button onclick="window.open('reports/Report.xlsx', '_blank')">📊 Open Report (Excel)</button>
        <input type="text" id="searchInput" placeholder="Search evidence..." onkeyup="filterTable()">
    </div>
    
    <table id="evidenceTable">
        <thead>
            <tr>
                <th>Control Code</th>
                <th>Control Title</th>
                <th>Evidence Title</th>
                <th>File Name</th>
                <th>Type</th>
                <th>Size (KB)</th>
                <th>Description</th>
            </tr>
        </thead>
        <tbody>
            ${evidenceList.map(ev => `
                <tr>
                    <td><strong>${ev.controlCode}</strong></td>
                    <td>${ev.controlTitle}</td>
                    <td>${ev.evidenceTitle}</td>
                    <td><a href="evidence/${ev.safeFileName}" class="evidence-link" target="_blank">${ev.fileName}</a></td>
                    <td>${ev.fileType}</td>
                    <td>${ev.sizeKB}</td>
                    <td>${ev.description}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
    
    <script>
        function filterTable() {
            const input = document.getElementById('searchInput');
            const filter = input.value.toLowerCase();
            const table = document.getElementById('evidenceTable');
            const rows = table.getElementsByTagName('tr');
            
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(filter) ? '' : 'none';
            }
        }
    </script>
</body>
</html>`;
}