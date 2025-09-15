import { ComplianceReport } from "./reportData";

export function renderComplianceHTML(report: ComplianceReport, lang: 'en' | 'ar' = 'en', evidenceLinksAvailable: boolean = false): string {
  const isRTL = lang === 'ar';
  const direction = isRTL ? 'rtl' : 'ltr';

  const template = `
<!DOCTYPE html>
<html dir="${direction}" lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Compliance Report - ${report.project.name}</title>
    <style>
        @page {
            size: A4;
            margin: 16mm;
            @top-center {
                content: "Compliance Report - ${report.project.name}";
                font-size: 10pt;
                color: #666;
            }
            @bottom-center {
                content: "Generated on ${new Date(report.generatedAt).toLocaleDateString()} | Page " counter(page) " of " counter(pages);
                font-size: 9pt;
                color: #666;
            }
        }
        
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            direction: ${direction};
            margin: 0;
            padding: 0;
        }
        
        .header {
            border-bottom: 3px solid #2699A6;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        
        .header h1 {
            color: #2699A6;
            font-size: 28pt;
            margin: 0;
            font-weight: bold;
        }
        
        .header .subtitle {
            font-size: 14pt;
            color: #666;
            margin-top: 10px;
        }
        
        .summary-section {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
        }
        
        .summary-item {
            text-align: center;
            padding: 15px;
            background: white;
            border-radius: 6px;
            border: 1px solid #e5e7eb;
        }
        
        .summary-number {
            font-size: 32pt;
            font-weight: bold;
            color: #2699A6;
            display: block;
        }
        
        .summary-label {
            font-size: 11pt;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .controls-section {
            margin-top: 40px;
        }
        
        .domain-group {
            margin-bottom: 40px;
            page-break-inside: avoid;
        }
        
        .domain-header {
            background: #2699A6;
            color: white;
            padding: 15px 20px;
            font-size: 16pt;
            font-weight: bold;
            margin-bottom: 0;
        }
        
        .control-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 10pt;
        }
        
        .control-table th {
            background: #f3f4f6;
            padding: 12px 8px;
            text-align: ${isRTL ? 'right' : 'left'};
            border: 1px solid #d1d5db;
            font-weight: bold;
        }
        
        .control-table td {
            padding: 10px 8px;
            border: 1px solid #d1d5db;
            vertical-align: top;
        }
        
        .control-row {
            page-break-inside: avoid;
        }
        
        .status-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 9pt;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .status-completed { background: #dcfce7; color: #166534; }
        .status-in-progress { background: #fef3c7; color: #92400e; }
        .status-review { background: #e0e7ff; color: #3730a3; }
        .status-pending { background: #f3f4f6; color: #374151; }
        .status-blocked { background: #fecaca; color: #991b1b; }
        
        .evidence-list {
            margin: 0;
            padding: 0;
            list-style: none;
        }
        
        .evidence-item {
            margin: 5px 0;
            padding: 8px;
            background: #f9fafb;
            border-radius: 4px;
            font-size: 9pt;
        }
        
        .evidence-filename {
            font-weight: bold;
            color: #2699A6;
        }
        
        .evidence-filename-plain {
            font-weight: bold;
            color: #374151;
        }
        
        .evidence-link {
            color: #2699A6;
            text-decoration: underline;
            font-weight: bold;
        }
        
        .evidence-link:hover {
            color: #1e7a85;
            text-decoration: underline;
        }
        
        .evidence-note {
            margin-top: 8px;
            padding: 6px;
            background: #fef3c7;
            border-radius: 4px;
            font-size: 8pt;
            color: #92400e;
        }
        
        .evidence-description {
            color: #666;
            margin-top: 4px;
        }
        
        .page-break {
            page-break-before: always;
        }
        
        .no-break {
            page-break-inside: avoid;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${isRTL ? report.project.nameAr || report.project.name : report.project.name}</h1>
        <div class="subtitle">
            ${lang === 'ar' ? 'تقرير الامتثال' : 'Compliance Report'} - ${report.regulation.name}
        </div>
        <div class="subtitle">
            ${lang === 'ar' ? 'تاريخ الإنشاء:' : 'Generated on:'} ${new Date(report.generatedAt).toLocaleDateString()}
        </div>
    </div>

    <div class="summary-section">
        <h2>${lang === 'ar' ? 'ملخص الامتثال' : 'Compliance Summary'}</h2>
        <div class="summary-grid">
            <div class="summary-item">
                <span class="summary-number">${report.totals.controls}</span>
                <span class="summary-label">${lang === 'ar' ? 'إجمالي الضوابط' : 'Total Controls'}</span>
            </div>
            <div class="summary-item">
                <span class="summary-number">${report.totals.approved}</span>
                <span class="summary-label">${lang === 'ar' ? 'موافق عليها' : 'Approved'}</span>
            </div>
            <div class="summary-item">
                <span class="summary-number">${report.totals.pending}</span>
                <span class="summary-label">${lang === 'ar' ? 'معلقة' : 'Pending'}</span>
            </div>
            <div class="summary-item">
                <span class="summary-number">${report.totals.inProgress}</span>
                <span class="summary-label">${lang === 'ar' ? 'قيد التنفيذ' : 'In Progress'}</span>
            </div>
        </div>
    </div>

    <div class="controls-section">
        <h2>${lang === 'ar' ? 'تفاصيل الضوابط' : 'Control Details'}</h2>
        ${generateControlsByDomain(report.controls, lang, evidenceLinksAvailable)}
    </div>
</body>
</html>`;

  return template;
}

function generateControlsByDomain(controls: ComplianceReport['controls'], lang: 'en' | 'ar', evidenceLinksAvailable: boolean = false): string {
  const domains = Array.from(new Set(controls.map(c => c.domain)));
  const isRTL = lang === 'ar';
  
  return domains.map(domain => {
    const domainControls = controls.filter(c => c.domain === domain);
    
    return `
      <div class="domain-group">
        <h3 class="domain-header">${domain}</h3>
        <table class="control-table">
          <thead>
            <tr>
              <th>${lang === 'ar' ? 'الرمز' : 'Code'}</th>
              <th>${lang === 'ar' ? 'العنوان' : 'Title'}</th>
              <th>${lang === 'ar' ? 'الحالة' : 'Status'}</th>
              <th>${lang === 'ar' ? 'الأدلة' : 'Evidence'}</th>
            </tr>
          </thead>
          <tbody>
            ${domainControls.map(control => `
              <tr class="control-row">
                <td><strong>${control.code}</strong></td>
                <td>${isRTL && control.titleAr ? control.titleAr : control.title}</td>
                <td>
                  <span class="status-badge status-${control.status}">
                    ${getStatusLabel(control.status, lang)}
                  </span>
                </td>
                <td>
                  ${control.evidence.length === 0 ? 
                    `<em>${lang === 'ar' ? 'لا توجد أدلة' : 'No evidence'}</em>` :
                    `<ul class="evidence-list">
                      ${control.evidence.map(ev => {
                        const safeFileName = ev.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
                        const safePath = `evidence/${control.code}__${safeFileName}`;
                        
                        if (evidenceLinksAvailable) {
                          return `
                            <li class="evidence-item">
                              <div class="evidence-filename">
                                <a href="${safePath}" class="evidence-link">${ev.fileName}</a>
                              </div>
                              ${ev.description ? `<div class="evidence-description">${ev.description}</div>` : ''}
                            </li>
                          `;
                        } else {
                          return `
                            <li class="evidence-item">
                              <div class="evidence-filename-plain">${ev.fileName}</div>
                              ${ev.description ? `<div class="evidence-description">${ev.description}</div>` : ''}
                            </li>
                          `;
                        }
                      }).join('')}
                      ${!evidenceLinksAvailable && control.evidence.length > 0 ? 
                        `<li class="evidence-note">
                          <em>${lang === 'ar' ? 'ملف الأدلة متوفر بصيغة منفصلة' : 'Evidence file: Evidence files available in ZIP bundle'}</em>
                        </li>` : ''
                      }
                    </ul>`
                  }
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }).join('');
}

function getStatusLabel(status: string, lang: 'en' | 'ar'): string {
  const labels = {
    en: {
      pending: 'Pending',
      'in-progress': 'In Progress',
      review: 'Under Review',
      completed: 'Completed',
      blocked: 'Blocked'
    },
    ar: {
      pending: 'معلق',
      'in-progress': 'قيد التنفيذ',
      review: 'قيد المراجعة',
      completed: 'مكتمل',
      blocked: 'محظور'
    }
  };
  
  return labels[lang][status as keyof typeof labels['en']] || status;
}