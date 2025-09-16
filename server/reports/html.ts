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
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 40px;
            border: 2px solid #2699A6;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .summary-title {
            text-align: center;
            font-size: 18pt;
            font-weight: bold;
            color: #2699A6;
            margin-bottom: 20px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 20px;
        }

        .summary-item {
            text-align: center;
            padding: 20px 15px;
            background: white;
            border-radius: 8px;
            border: 2px solid #e5e7eb;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
            transition: transform 0.2s;
        }

        .summary-item:hover {
            transform: translateY(-2px);
            border-color: #2699A6;
        }

        .summary-number {
            font-size: 36pt;
            font-weight: bold;
            color: #2699A6;
            display: block;
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1);
        }

        .summary-label {
            font-size: 10pt;
            color: #555;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 600;
            margin-top: 5px;
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
            font-size: 9pt;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            border-radius: 6px;
            overflow: hidden;
        }

        .control-table th {
            background: linear-gradient(135deg, #2699A6 0%, #1e7a85 100%);
            color: white;
            padding: 15px 10px;
            text-align: ${isRTL ? 'right' : 'left'};
            border: none;
            font-weight: bold;
            font-size: 10pt;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .control-table td {
            padding: 12px 10px;
            border-bottom: 1px solid #e5e7eb;
            border-right: 1px solid #e5e7eb;
            vertical-align: top;
            background: white;
        }

        .control-table tr:nth-child(even) td {
            background: #f9fafb;
        }

        .control-table tr:hover td {
            background: #f0f9ff;
        }

        .control-code {
            font-weight: bold;
            color: #2699A6;
            font-size: 10pt;
            padding: 4px 8px;
            background: #e0f2fe;
            border-radius: 4px;
            display: inline-block;
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
            padding: 2px 6px;
            background: #f0f9ff;
            border-radius: 3px;
            border: 1px solid #2699A6;
            display: inline-block;
            margin: 2px;
            transition: all 0.2s;
        }

        .evidence-link:hover {
            color: white;
            background: #2699A6;
            text-decoration: none;
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(38, 153, 166, 0.3);
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
        <div class="summary-title">${lang === 'ar' ? 'لوحة معلومات الامتثال' : 'Compliance Dashboard'}</div>
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
        <div style="padding: 40px; text-align: center; background: #f9fafb; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #6b7280; margin-bottom: 10px;">${lang === 'ar' ? 'لا توجد ضوابط' : 'No Controls Available'}</h3>
          <p style="color: #9ca3af; font-size: 14px;">
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
                <td><span class="control-code">${control.code}</span></td>
                <td><strong>${isRTL && control.titleAr ? control.titleAr : control.title}</strong></td>
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
                        if (evidenceLinksAvailable) {
                          // Create clickable link to download evidence via API
                          const downloadUrl = baseUrl ? `${baseUrl}/api/evidence/${ev.id}/download` : `#evidence-${ev.id}`;
                          const fileType = ev.fileName.toLowerCase().includes('.pdf') ? '[PDF]' :
                                         ev.fileName.toLowerCase().includes('.png') || ev.fileName.toLowerCase().includes('.jpg') ? '[IMG]' :
                                         ev.fileName.toLowerCase().includes('.doc') ? '[DOC]' : '[FILE]';
                          return `
                            <li class="evidence-item">
                              <div class="evidence-filename">
                                <a href="${downloadUrl}" class="evidence-link" target="_blank">
                                  ${fileType} ${ev.fileName} [DOWNLOAD]
                                </a>
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