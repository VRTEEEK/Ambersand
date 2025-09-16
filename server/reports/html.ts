import { ComplianceReport } from "./reportData";

export function renderComplianceHTML(report: ComplianceReport, lang: 'en' | 'ar' = 'en', evidenceLinksAvailable: boolean = false, baseUrl: string = ''): string {
  console.log('🎨 Rendering compliance HTML report:', {
    projectName: report.project.name,
    regulationName: report.regulation.name,
    totalControls: report.controls.length,
    totalsData: report.totals,
    controlsPreview: report.controls.slice(0, 3).map(c => ({ code: c.code, title: c.title, domain: c.domain })),
    lang,
    evidenceLinksAvailable
  });

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
                font-size: 9pt;
                color: #333;
            }
            @bottom-center {
                content: "Generated on ${new Date(report.generatedAt).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US')} | Page " counter(page) " of " counter(pages);
                font-size: 9pt;
                color: #333;
            }
        }
        
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.4;
            color: #333;
            direction: ${direction};
            margin: 0;
            padding: 0;
            font-size: 11pt;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 30px;
        }
        
        .header .main-title {
            font-size: 18pt;
            font-weight: bold;
            color: #333;
            margin: 0 0 30px 0;
        }
        
        .header .project-name {
            font-size: 24pt;
            font-weight: bold;
            color: #333;
            margin: 0 0 10px 0;
        }
        
        .header .subtitle {
            font-size: 14pt;
            color: #333;
            margin: 5px 0;
        }

        .header .generated-date {
            font-size: 12pt;
            color: #333;
            margin: 20px 0;
        }
        
        .summary-section {
            margin-bottom: 40px;
        }

        .summary-title {
            font-size: 16pt;
            font-weight: bold;
            color: #333;
            margin-bottom: 30px;
        }

        .summary-grid {
            display: table;
            width: 100%;
            margin-bottom: 20px;
        }

        .summary-row {
            display: table-row;
        }

        .summary-item {
            display: table-cell;
            text-align: center;
            padding: 30px 20px;
            width: 50%;
            vertical-align: top;
        }

        .summary-number {
            font-size: 48pt;
            font-weight: bold;
            color: #333;
            display: block;
            line-height: 1;
        }

        .summary-label {
            font-size: 10pt;
            color: #333;
            text-transform: uppercase;
            font-weight: bold;
            margin-top: 5px;
            display: block;
        }
        
        .controls-section {
            margin-top: 50px;
        }
        
        .controls-title {
            font-size: 16pt;
            font-weight: bold;
            color: #333;
            margin-bottom: 30px;
        }
        
        .domain-group {
            margin-bottom: 30px;
            page-break-inside: avoid;
        }
        
        .domain-header {
            font-size: 12pt;
            font-weight: bold;
            color: #333;
            margin-bottom: 20px;
            padding-bottom: 5px;
        }
        
        .control-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            font-size: 10pt;
        }

        .control-table th {
            background: white;
            color: #333;
            padding: 10px 8px;
            text-align: left;
            border-bottom: 1px solid #333;
            font-weight: bold;
            font-size: 11pt;
        }

        .control-table td {
            padding: 10px 8px;
            border-bottom: none;
            vertical-align: top;
            background: white;
        }

        .control-code {
            font-weight: bold;
            color: #333;
        }
        
        .control-row {
            page-break-inside: avoid;
        }
        
        .control-title {
            color: #333;
        }
        
        .control-status {
            font-weight: bold;
            text-transform: uppercase;
            color: #333;
        }
        
        .evidence-content {
            color: #333;
        }
        
        .evidence-filename {
            color: #333;
            display: block;
            margin-bottom: 2px;
        }
        
        .evidence-description {
            color: #333;
            font-style: italic;
            font-size: 9pt;
            margin-top: 2px;
        }
        
        .no-evidence {
            color: #333;
            font-style: italic;
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
        <div class="main-title">Compliance Report - ${isRTL ? report.project.nameAr || report.project.name : report.project.name}</div>
        
        <div class="project-name">${isRTL ? report.project.nameAr || report.project.name : report.project.name}</div>
        
        <div class="subtitle">
            ${lang === 'ar' ? 'تقرير الامتثال' : 'Compliance Report'} - ${report.regulation.name}
        </div>
        
        <div class="generated-date">
            ${lang === 'ar' ? 'تاريخ الإنشاء:' : 'Generated on:'} ${new Date(report.generatedAt).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US')}
        </div>
    </div>

    <div class="summary-section">
        <div class="summary-title">${lang === 'ar' ? 'ملخص الامتثال' : 'Compliance Summary'}</div>
        <div class="summary-grid">
            <div class="summary-row">
                <div class="summary-item">
                    <span class="summary-number">${report.totals.controls}</span>
                    <span class="summary-label">${lang === 'ar' ? 'إجمالي الضوابط' : 'Total Controls'}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-number">${report.totals.approved}</span>
                    <span class="summary-label">${lang === 'ar' ? 'موافق عليها' : 'Approved'}</span>
                </div>
            </div>
            <div class="summary-row">
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
    </div>

    <div class="controls-section">
        <div class="controls-title">${lang === 'ar' ? 'تفاصيل الضوابط' : 'Control Details'}</div>
        ${generateControlsByDomain(report.controls, lang, evidenceLinksAvailable, baseUrl)}
    </div>
</body>
</html>`;

  return template;
}

function generateControlsByDomain(controls: ComplianceReport['controls'], lang: 'en' | 'ar', evidenceLinksAvailable: boolean = false, baseUrl: string = ''): string {
  console.log('🔧 Generating controls by domain:', {
    totalControls: controls.length,
    domains: Array.from(new Set(controls.map(c => c.domain))),
    evidenceLinksAvailable,
    sampleControl: controls[0] ? {
      code: controls[0].code,
      title: controls[0].title,
      domain: controls[0].domain,
      evidenceCount: controls[0].evidence?.length || 0
    } : null
  });

  const domains = Array.from(new Set(controls.map(c => c.domain)));
  const isRTL = lang === 'ar';
  
  if (domains.length === 0) {
    console.log('⚠️ No domains found, generating empty controls message');
    return `
      <div class="domain-group">
        <div style="padding: 40px; text-align: center; margin: 20px 0;">
          <h3 style="color: #333; margin-bottom: 10px;">${lang === 'ar' ? 'لا توجد ضوابط' : 'No Controls Available'}</h3>
          <p style="color: #333; font-size: 14px;">
            ${lang === 'ar'
              ? 'لم يتم العثور على ضوابط لهذا المشروع. يرجى إضافة ضوابط لإنشاء التقرير.'
              : 'No controls found for this project. Please add controls to generate the report.'
            }
          </p>
        </div>
      </div>
    `;
  }

  return domains.map(domain => {
    const domainControls = controls.filter(c => c.domain === domain);

    return `
      <div class="domain-group">
        <div class="domain-header">${domain}</div>
        
        <table class="control-table">
          <thead>
            <tr>
              <th style="width: 10%;">${lang === 'ar' ? 'الرمز' : 'Code'}</th>
              <th style="width: 50%;">${lang === 'ar' ? 'العنوان' : 'Title'}</th>
              <th style="width: 15%;">${lang === 'ar' ? 'الحالة' : 'Status'}</th>
              <th style="width: 25%;">${lang === 'ar' ? 'الأدلة' : 'Evidence'}</th>
            </tr>
          </thead>
          <tbody>
            ${domainControls.map(control => `
              <tr class="control-row">
                <td><span class="control-code">${control.code}</span></td>
                <td class="control-title">${isRTL && control.titleAr ? control.titleAr : control.title}</td>
                <td class="control-status">${getStatusLabel(control.status, lang)}</td>
                <td class="evidence-content">
                  ${control.evidence.length === 0 ? 
                    `<span class="no-evidence">${lang === 'ar' ? 'لا توجد أدلة' : 'No evidence'}</span>` :
                    control.evidence.map(ev => `
                      <div class="evidence-filename">${ev.fileName}</div>
                      ${ev.description ? `<div class="evidence-description">${lang === 'ar' ? 'ملف أدلة:' : 'Evidence file:'} ${ev.description}</div>` : 
                        `<div class="evidence-description">${lang === 'ar' ? 'ملف أدلة:' : 'Evidence file:'} ${ev.fileName}</div>`
                      }
                    `).join('')
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