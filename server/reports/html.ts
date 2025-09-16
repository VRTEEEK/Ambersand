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
            margin: 20mm 16mm;
            @top-center {
                content: "Compliance Report - ${report.project.name}";
                font-size: 10pt;
                color: #64748b;
            }
            @bottom-center {
                content: "Generated on ${new Date(report.generatedAt).toLocaleDateString()} | Page " counter(page) " of " counter(pages);
                font-size: 9pt;
                color: #64748b;
            }
        }
        
        body {
            font-family: 'Inter', 'Segoe UI', 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
            line-height: 1.7;
            color: #1e293b;
            direction: ${direction};
            margin: 0;
            padding: 0;
            background: #ffffff;
        }
        
        .header {
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);
            color: white;
            padding: 40px 30px;
            margin: -20px -16mm 40px -16mm;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        
        .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E") repeat;
            z-index: 1;
        }
        
        .header-content {
            position: relative;
            z-index: 2;
        }
        
        .header h1 {
            font-size: 32pt;
            margin: 0 0 15px 0;
            font-weight: 700;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
            letter-spacing: -0.02em;
        }
        
        .header .subtitle {
            font-size: 16pt;
            opacity: 0.95;
            margin: 8px 0;
            font-weight: 500;
        }
        
        .header .generated-date {
            font-size: 12pt;
            opacity: 0.8;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .summary-section {
            background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
            padding: 40px 30px;
            border-radius: 16px;
            margin-bottom: 50px;
            border: 1px solid #cbd5e1;
            box-shadow: 0 8px 32px rgba(15, 23, 42, 0.08);
            position: relative;
        }

        .summary-title {
            text-align: center;
            font-size: 22pt;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 30px;
            text-transform: none;
            letter-spacing: -0.01em;
            position: relative;
        }

        .summary-title::after {
            content: '';
            position: absolute;
            bottom: -10px;
            left: 50%;
            transform: translateX(-50%);
            width: 60px;
            height: 3px;
            background: linear-gradient(90deg, #0ea5e9, #06b6d4);
            border-radius: 2px;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 25px;
            margin-top: 20px;
        }

        .summary-item {
            text-align: center;
            padding: 30px 20px;
            background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }

        .summary-item::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #0ea5e9, #06b6d4);
        }

        .summary-item:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 32px rgba(15, 23, 42, 0.15);
        }

        .summary-number {
            font-size: 42pt;
            font-weight: 800;
            color: #0f172a;
            display: block;
            margin-bottom: 8px;
            line-height: 1;
        }

        .summary-label {
            font-size: 11pt;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            font-weight: 600;
            margin-top: 5px;
        }
        
        .controls-section {
            margin-top: 50px;
        }
        
        .controls-section h2 {
            font-size: 24pt;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 30px;
            text-align: center;
            position: relative;
        }

        .controls-section h2::after {
            content: '';
            position: absolute;
            bottom: -8px;
            left: 50%;
            transform: translateX(-50%);
            width: 80px;
            height: 3px;
            background: linear-gradient(90deg, #0ea5e9, #06b6d4);
            border-radius: 2px;
        }
        
        .domain-group {
            margin-bottom: 50px;
            page-break-inside: avoid;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(15, 23, 42, 0.08);
            border: 1px solid #e2e8f0;
        }
        
        .domain-header {
            background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
            color: white;
            padding: 20px 25px;
            font-size: 18pt;
            font-weight: 700;
            margin-bottom: 0;
            position: relative;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        }

        .domain-header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M20 20L0 20L0 0L20 0Z'/%3E%3C/g%3E%3C/svg%3E") repeat;
        }
        
        .control-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 0;
            font-size: 10pt;
            background: white;
        }

        .control-table th {
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            color: white;
            padding: 18px 15px;
            text-align: ${isRTL ? 'right' : 'left'};
            border: none;
            font-weight: 700;
            font-size: 11pt;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            position: relative;
        }

        .control-table td {
            padding: 16px 15px;
            border-bottom: 1px solid #f1f5f9;
            vertical-align: top;
            background: white;
            transition: background-color 0.2s ease;
        }

        .control-table tr:nth-child(even) td {
            background: #f8fafc;
        }

        .control-table tr:hover td {
            background: #e0f2fe !important;
        }

        .control-code {
            font-weight: 700;
            color: #0ea5e9;
            font-size: 11pt;
            padding: 8px 12px;
            background: linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%);
            border-radius: 8px;
            border: 1px solid #0ea5e9;
            display: inline-block;
            box-shadow: 0 2px 4px rgba(14, 165, 233, 0.1);
        }
        
        .control-row {
            page-break-inside: avoid;
            border-bottom: 1px solid #f1f5f9;
        }
        
        .status-badge {
            display: inline-block;
            padding: 8px 12px;
            border-radius: 20px;
            font-size: 10pt;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .status-completed { 
            background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%); 
            color: #166534; 
            border: 1px solid #22c55e;
        }
        .status-in-progress { 
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); 
            color: #92400e;
            border: 1px solid #f59e0b;
        }
        .status-review { 
            background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%); 
            color: #3730a3;
            border: 1px solid #6366f1;
        }
        .status-pending { 
            background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); 
            color: #374151;
            border: 1px solid #9ca3af;
        }
        .status-blocked { 
            background: linear-gradient(135deg, #fecaca 0%, #fca5a5 100%); 
            color: #991b1b;
            border: 1px solid #ef4444;
        }
        
        .evidence-list {
            margin: 0;
            padding: 0;
            list-style: none;
            max-width: 100%;
        }
        
        .evidence-item {
            margin: 8px 0;
            padding: 12px 15px;
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border-radius: 8px;
            font-size: 10pt;
            border: 1px solid #e2e8f0;
            transition: all 0.2s ease;
        }

        .evidence-item:hover {
            background: linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%);
            border-color: #0ea5e9;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(14, 165, 233, 0.15);
        }
        
        .evidence-filename {
            font-weight: 700;
            color: #0ea5e9;
        }
        
        .evidence-filename-plain {
            font-weight: 700;
            color: #334155;
        }
        
        .evidence-link {
            color: #ffffff !important;
            text-decoration: none !important;
            font-weight: 700;
            padding: 8px 16px;
            background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%);
            border-radius: 6px;
            border: none;
            display: inline-block;
            margin: 4px 2px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3);
            font-size: 10pt;
            letter-spacing: 0.3px;
        }

        .evidence-link:hover {
            background: linear-gradient(135deg, #0284c7 0%, #0891b2 100%);
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(14, 165, 233, 0.4);
        }

        .evidence-link:active {
            transform: translateY(0);
            box-shadow: 0 2px 8px rgba(14, 165, 233, 0.3);
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
        <div class="header-content">
            <h1>${isRTL ? report.project.nameAr || report.project.name : report.project.name}</h1>
            <div class="subtitle">
                ${lang === 'ar' ? 'تقرير الامتثال' : 'Compliance Report'} - ${report.regulation.name}
            </div>
            <div class="generated-date">
                ${lang === 'ar' ? 'تاريخ الإنشاء:' : 'Generated on:'} ${new Date(report.generatedAt).toLocaleDateString()}
            </div>
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