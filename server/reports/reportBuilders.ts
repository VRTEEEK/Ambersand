import wkhtmltopdf from 'wkhtmltopdf';
import { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } from 'docx';
import ExcelJS from 'exceljs';
import archiver from 'archiver';
import sanitizeFilename from 'sanitize-filename';
import { ComplianceReport } from './reportData';
import { createReadStream, existsSync } from 'fs';
import { Response } from 'express';
import { execSync } from 'child_process';
import path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { convert as htmlToText } from 'html-to-text';

export async function buildPDF(html: string): Promise<Buffer> {
  try {
    console.log('🚀 Generating PDF with wkhtmltopdf...');

    // Check if wkhtmltopdf is available
    try {
      execSync('which wkhtmltopdf', { stdio: 'ignore' });
      console.log('✅ wkhtmltopdf binary found in PATH');
      
      // If wkhtmltopdf is available, use it
      return await buildPDFWithWkhtmltopdf(html);
    } catch (error) {
      console.warn('⚠️ wkhtmltopdf binary not found in PATH. Attempting to use nix-env to locate...');
      
      try {
        // Try to find wkhtmltopdf in common locations with timeout
        const locations = [
          '/usr/bin/wkhtmltopdf',
          '/usr/local/bin/wkhtmltopdf'
        ];

        let foundPath = null;
        for (const location of locations) {
          try {
            execSync(`ls ${location}`, { stdio: 'ignore', timeout: 5000 });
            foundPath = location;
            break;
          } catch (e) {
            // Continue searching
          }
        }

        // Try Nix store search with timeout
        if (!foundPath) {
          try {
            const nixPath = execSync('find /nix/store -maxdepth 2 -name "*wkhtmltopdf*" -type d 2>/dev/null | head -1', { 
              stdio: 'pipe', 
              timeout: 10000,
              encoding: 'utf8'
            }).toString().trim();
            
            if (nixPath) {
              const binaryPath = `${nixPath}/bin/wkhtmltopdf`;
              try {
                execSync(`test -f ${binaryPath}`, { stdio: 'ignore', timeout: 2000 });
                foundPath = binaryPath;
              } catch (e) {
                // Binary not found in expected location
              }
            }
          } catch (e) {
            console.warn('⚠️  Nix store search timed out or failed');
          }
        }

        if (foundPath && foundPath.length > 0) {
          console.log(`📍 Found wkhtmltopdf at: ${foundPath}`);
          process.env.PATH = `${path.dirname(foundPath)}:${process.env.PATH}`;
          console.log('✅ Added wkhtmltopdf to PATH');
          
          // Try wkhtmltopdf after updating PATH
          return await buildPDFWithWkhtmltopdf(html);
        } else {
          throw new Error('wkhtmltopdf binary not found in any common locations.');
        }
      } catch (searchError) {
        console.error('❌ wkhtmltopdf search failed:', searchError);
        console.log('🔄 Falling back to JavaScript PDF generation...');
        return await buildPDFWithJavaScript(html);
      }
    }
  } catch (error) {
    console.error('❌ PDF generation failed, falling back to JavaScript:', error);
    return await buildPDFWithJavaScript(html);
  }
}

// Separate function for wkhtmltopdf
async function buildPDFWithWkhtmltopdf(html: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      // Configure wkhtmltopdf options for optimal PDF generation
      const options: any = {
        pageSize: 'A4',
        orientation: 'Portrait',
        marginTop: '20mm',
        marginBottom: '20mm',
        marginLeft: '12mm',
        marginRight: '12mm',
        printMediaType: true,
        enableLocalFileAccess: true,
        javascriptDelay: 1000, // Wait for JS to execute
        loadErrorHandling: 'ignore',
        loadMediaErrorHandling: 'ignore',
        encoding: 'utf-8',
        userStyleSheet: '',
        // Footer with page numbers
        footerCenter: `Generated on ${new Date().toLocaleDateString()} | Page [page] of [topage]`,
        footerFontSize: 10,
        footerSpacing: 5,
        // Enable features for better rendering
        enableIntelligentShrinking: true,
        minimumFontSize: 8,
        // Timeout settings
        javascriptTimeout: 30000,
        // Quality settings
        quality: 94,
        // Disable problematic features that can cause crashes
        noStop: true,
        debugJavascript: false
      };

      // Set custom binary path if provided
      if (process.env.WKHTMLTOPDF_PATH) {
        console.log('📍 Using custom wkhtmltopdf path:', process.env.WKHTMLTOPDF_PATH);
        process.env.PATH = `${process.env.WKHTMLTOPDF_PATH}:${process.env.PATH}`;
      }

      console.log('🔧 wkhtmltopdf options:', JSON.stringify(options, null, 2));
      console.log('📄 Processing HTML content...');

      // Enhance HTML for better PDF rendering
      const enhancedHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.4;
              color: #333;
            }
            a {
              color: #2699A6 !important;
              text-decoration: underline !important;
            }
            @media print {
              .no-print { display: none !important; }
              a { color: #2699A6 !important; }
            }
            img { max-width: 100%; height: auto; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; }
          </style>
        </head>
        <body>
          ${html}
        </body>
        </html>
      `;

      console.log('🖨️  Generating PDF...');

      // Generate PDF using wkhtmltopdf
      const pdfStream = wkhtmltopdf(enhancedHtml, options);
      const chunks: Buffer[] = [];

      pdfStream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      pdfStream.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        console.log(`✅ PDF generated successfully (${pdfBuffer.length} bytes)`);
        resolve(pdfBuffer);
      });

      pdfStream.on('error', (error: Error) => {
        console.error('❌ PDF generation failed:', error);
        reject(new Error(`PDF generation failed: ${error.message}`));
      });

      // Set timeout for the entire operation
      setTimeout(() => {
        reject(new Error('PDF generation timed out after 60 seconds'));
      }, 60000);

    } catch (error) {
      console.error('❌ PDF generation failed:', error);
      reject(new Error(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  });
}

// Fallback PDF generation using pure JavaScript
async function buildPDFWithJavaScript(html: string): Promise<Buffer> {
  try {
    console.log('📄 Generating PDF using JavaScript fallback...');
    
    // Convert HTML to plain text with some formatting preserved
    const text = htmlToText(html, {
      wordwrap: 80,
      selectors: [
        { selector: 'h1', options: { uppercase: false, format: 'block' } },
        { selector: 'h2', options: { uppercase: false, format: 'block' } },
        { selector: 'h3', options: { uppercase: false, format: 'block' } },
        { selector: 'p', options: { format: 'block' } },
        { selector: 'table', options: { uppercaseHeaderCells: false } }
      ]
    });

    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Define page dimensions and margins
    const pageWidth = 595.28; // A4 width in points
    const pageHeight = 841.89; // A4 height in points
    const margin = 50;
    const contentWidth = pageWidth - 2 * margin;
    const contentHeight = pageHeight - 2 * margin;

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let yPosition = pageHeight - margin;

    // Split text into lines and add to PDF
    const lines = text.split('\n');
    const fontSize = 12;
    const lineHeight = fontSize * 1.2;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if we need a new page
      if (yPosition - lineHeight < margin) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        yPosition = pageHeight - margin;
      }

      // Determine if this is a header (simple heuristic)
      const isHeader = line.length > 0 && line.length < 100 && 
                      (line.includes('Compliance') || line.includes('Report') || 
                       line.includes('Project') || line.includes('Control'));

      // Draw the text
      page.drawText(line, {
        x: margin,
        y: yPosition,
        size: isHeader ? fontSize + 2 : fontSize,
        font: isHeader ? helveticaBoldFont : timesRomanFont,
        color: rgb(0, 0, 0),
        maxWidth: contentWidth,
      });

      yPosition -= lineHeight;
    }

    // Add footer with generation info
    const footerText = `Generated on ${new Date().toLocaleDateString()} | Page 1`;
    const pages = pdfDoc.getPages();
    pages.forEach((page, index) => {
      page.drawText(footerText.replace('Page 1', `Page ${index + 1}`), {
        x: margin,
        y: 30,
        size: 10,
        font: timesRomanFont,
        color: rgb(0.5, 0.5, 0.5),
      });
    });

    const pdfBytes = await pdfDoc.save();
    console.log(`✅ JavaScript PDF generated successfully (${pdfBytes.length} bytes)`);
    
    return Buffer.from(pdfBytes);
  } catch (error) {
    console.error('❌ JavaScript PDF generation failed:', error);
    throw new Error(`JavaScript PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
  
  console.log(`📦 streamBundle called with includeEvidence: ${includeEvidence}, formats:`, formats);
  console.log(`📋 Report has ${report.controls.length} controls`);
  const totalEvidence = report.controls.reduce((acc, c) => acc + c.evidence.length, 0);
  console.log(`📄 Total evidence files found: ${totalEvidence}`);
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
            try {
              archive.append(createReadStream(ev.filePath), { name: `evidence/${safeFileName}` });
            } catch (error) {
              console.error(`❌ Failed to add evidence file ${ev.fileName}:`, error);
              // Log the error but continue processing other files
            }
          } else {
            console.warn(`⚠️  Evidence file not found: ${ev.fileName} at ${ev.filePath}`);
            // Skip missing files instead of creating placeholders
            // This prevents cluttering the export with placeholder files
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