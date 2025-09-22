import { db } from "../db";
import { projects, projectControls, projectRegulationControls, eccControls, regulationControls, evidence, tasks, users } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import path from "path";
import { existsSync } from "fs";

export interface ComplianceReport {
  project: { 
    id: number; 
    name: string; 
    nameAr: string | null;
    owner?: string; 
    organizationId: string; 
  };
  regulation: { 
    code: string; 
    name: string; 
    version?: string; 
  };
  generatedAt: string;
  totals: { 
    controls: number; 
    approved: number; 
    pending: number; 
    inProgress: number;
    review: number;
    blocked: number;
  };
  controls: Array<{
    id: number; 
    code: string; 
    title: string; 
    titleAr: string | null;
    domain: string; 
    subdomain?: string | null;
    status: 'pending' | 'in-progress' | 'review' | 'completed' | 'blocked';
    approver?: string | null; 
    updatedAt?: string;
    evidence: Array<{
      id: number; 
      title: string; 
      fileName: string; 
      fileType?: string | null; 
      fileSize?: number | null;
      filePath: string;
      description?: string | null;
    }>;
  }>;
}

export async function getComplianceReportData(params: {
  projectId: number;
  regulationCode?: string;
  controlStatusFilter?: 'all' | 'approved' | 'unapproved' | { in: string[] };
  organizationId?: string;
}): Promise<ComplianceReport> {
  const { projectId, regulationCode, controlStatusFilter, organizationId } = params;

  let project: any[];
  try {
    console.log(`📊 Generating compliance report for project ${projectId}...`);

    // Get project details
    const projectConditions = [eq(projects.id, projectId)];
    if (organizationId) {
      projectConditions.push(eq(projects.organizationId, organizationId));
    }

    project = await db.select()
      .from(projects)
      .where(and(...projectConditions))
      .limit(1);

    if (!project[0]) {
      throw new Error(`Project ${projectId} not found or access denied`);
    }

    console.log(`✅ Project found: ${project[0].name}`);
  } catch (error) {
    console.error(`❌ Database error while fetching project ${projectId}:`, error);
    throw new Error(`Failed to retrieve project data: ${error instanceof Error ? error.message : 'Unknown database error'}`);
  }

  // Get project controls with their status and control details
  let filteredControls;
  let isUsingLegacyControls = false;
  try {
    // First try modern regulation controls
    let modernControlsQuery = db.select({
      id: projectRegulationControls.id,
      controlId: projectRegulationControls.controlId,
      status: projectRegulationControls.status,
      assignedTo: projectRegulationControls.assignedTo,
      updatedAt: projectRegulationControls.updatedAt,
      control: regulationControls
    })
      .from(projectRegulationControls)
      .innerJoin(regulationControls, eq(projectRegulationControls.controlId, regulationControls.id))
      .where(eq(projectRegulationControls.projectId, projectId));
    
    if (regulationCode) {
      modernControlsQuery = modernControlsQuery.where(
        and(
          eq(projectRegulationControls.projectId, projectId),
          eq(regulationControls.regulationCode, regulationCode)
        )
      );
    }

    const modernControls = await modernControlsQuery;
    
    if (modernControls.length > 0) {
      // Use modern controls system
      console.log(`📋 Using modern regulation controls: Found ${modernControls.length} controls for project`);
      isUsingLegacyControls = false;
      filteredControls = modernControls.map(mc => ({
        id: mc.id,
        controlId: mc.controlId,
        status: mc.status,
        assignedTo: mc.assignedTo,
        updatedAt: mc.updatedAt,
        control: {
          // Map regulation control fields to expected format
          code: mc.control.clause,
          titleEn: mc.control.mainControlEn,
          titleAr: mc.control.mainControlAr,
          controlEn: mc.control.descriptionEn,
          controlAr: mc.control.descriptionAr,
          domainEn: mc.control.mainCategoryEn,
          domainAr: mc.control.mainCategoryAr,
          subdomainEn: mc.control.subCategoryEn,
          subdomainAr: mc.control.subCategoryAr
        }
      }));
    } else {
      // Fallback to legacy projectControls with eccControls
      console.log(`📋 No modern controls found, trying legacy projectControls system...`);
      
      // Legacy controls are only ECC controls, so only use if regulationCode is ECC or not specified
      if (!regulationCode || regulationCode.includes('ECC') || regulationCode === 'NCA-ECC-2024') {
        isUsingLegacyControls = true;
        const legacyControlsQuery = db.select({
          id: projectControls.id,
          controlId: projectControls.eccControlId,
          status: projectControls.status,
          assignedTo: projectControls.assignedTo,
          updatedAt: projectControls.updatedAt,
          control: eccControls
        })
          .from(projectControls)
          .innerJoin(eccControls, eq(projectControls.eccControlId, eccControls.id))
          .where(eq(projectControls.projectId, projectId));

        const legacyControls = await legacyControlsQuery;
        console.log(`📋 Using legacy ECC controls: Found ${legacyControls.length} controls for project`);
        
        filteredControls = legacyControls.map(lc => ({
          id: lc.id,
          controlId: lc.controlId,
          status: lc.status,
          assignedTo: lc.assignedTo,
          updatedAt: lc.updatedAt,
          control: lc.control // ECC controls already have the expected field names
        }));
      } else {
        // Requested regulation is not ECC, and we only have legacy ECC controls - no match
        console.log(`📋 Requested regulation '${regulationCode}' but project only has legacy ECC controls - returning empty result`);
        filteredControls = [];
      }
    }

    console.log(`📋 Total filtered controls: ${filteredControls.length}`);
  } catch (error) {
    console.error(`❌ Database error while fetching project controls:`, error);
    throw new Error(`Failed to retrieve project controls: ${error instanceof Error ? error.message : 'Unknown database error'}`);
  }

  // Apply status filter
  if (controlStatusFilter && controlStatusFilter !== 'all') {
    if (controlStatusFilter === 'approved') {
      filteredControls = filteredControls.filter(c => c.status === 'completed');
    } else if (controlStatusFilter === 'unapproved') {
      filteredControls = filteredControls.filter(c => c.status !== 'completed');
    } else if (typeof controlStatusFilter === 'object' && controlStatusFilter.in) {
      filteredControls = filteredControls.filter(c => controlStatusFilter.in.includes(c.status));
    }
  }

  // Get evidence for each control
  const controlsWithEvidence = await Promise.all(
    filteredControls.map(async (control) => {
      const controlData = control.control;
      const controlId = control.controlId;

      let controlEvidence: any[] = [];
      try {
        // For legacy controls, we can fetch evidence by eccControlId
        // For modern regulation controls, evidence system needs migration so we skip for now
        if (isUsingLegacyControls && controlId) {
          // This is legacy ECC control - fetch evidence by eccControlId
          controlEvidence = await db.select()
            .from(evidence)
            .where(eq(evidence.eccControlId, controlId!));
          
          console.log(`🔍 Control ${controlData?.code || 'UNKNOWN'}: Found ${controlEvidence.length} evidence files`);
        } else {
          // This is modern regulation control - evidence system migration pending
          controlEvidence = [];
          console.log(`🔍 Control ${controlData?.code || 'UNKNOWN'}: Found ${controlEvidence.length} evidence files (evidence migration pending for regulation controls)`);
        }
        
        if (controlEvidence.length > 0) {
          controlEvidence.forEach(ev => {
            console.log(`  📄 Evidence: ${ev.title} (${ev.fileName}) at ${ev.filePath}`);
          });
        }
      } catch (error) {
        console.error(`❌ Error fetching evidence for control ${controlData?.code || 'UNKNOWN'}:`, error);
        // Continue with empty evidence array
        controlEvidence = [];
      }

      return {
        id: controlId!,
        code: controlData.code,
        title: controlData.titleEn || controlData.controlEn,
        titleAr: controlData.titleAr || controlData.controlAr || null,
        domain: controlData.domainEn,
        subdomain: controlData.subdomainEn || null,
        status: control.status as 'pending' | 'in-progress' | 'review' | 'completed' | 'blocked',
        approver: control.assignedTo || null,
        updatedAt: control.updatedAt?.toISOString(),
        evidence: (controlEvidence as any[]).map(ev => {
          // Ensure absolute file path and validate it exists
          let absPath = path.isAbsolute(ev.filePath) ? ev.filePath : path.join(process.cwd(), ev.filePath);
          let fileExists = existsSync(absPath);

          // Try common upload directories if the original path doesn't exist
          if (!fileExists && !path.isAbsolute(ev.filePath)) {
            const possiblePaths = [
              path.join(process.cwd(), ev.filePath),
              path.join(process.cwd(), 'uploads', ev.fileName),
              path.join(process.cwd(), 'evidence', ev.fileName),
              path.join(process.cwd(), 'public', 'uploads', ev.fileName)
            ];

            for (const possiblePath of possiblePaths) {
              if (existsSync(possiblePath)) {
                absPath = possiblePath;
                fileExists = true;
                console.log(`📍 Found evidence file at: ${absPath}`);
                break;
              }
            }
          }

          // Log missing files but still include them in the evidence list with a note
          if (!fileExists) {
            console.warn(`⚠️ Evidence file missing: ${ev.fileName} (expected at ${absPath})`);
          }

          return {
            id: ev.id,
            title: ev.title,
            fileName: ev.fileName,
            fileType: ev.fileType || null,
            fileSize: ev.fileSize || null,
            filePath: absPath,
            description: ev.description || null,
            fileExists: fileExists
          };
        }).filter(ev => ev.fileExists)
      };
    })
  );

  // Calculate totals
  const statusCounts = filteredControls.reduce((acc, control) => {
    const status = control.status as string;
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totals = {
    controls: filteredControls.length,
    approved: statusCounts.completed || 0,
    pending: statusCounts.pending || 0,
    inProgress: statusCounts['in-progress'] || 0,
    review: statusCounts.review || 0,
    blocked: statusCounts.blocked || 0
  };

  return {
    project: {
      id: project[0].id,
      name: project[0].name,
      nameAr: project[0].nameAr,
      organizationId: project[0].organizationId || ''
    },
    regulation: {
      code: regulationCode || 'NCA-ECC-2:2024',
      name: regulationCode === 'NCA-ECC-2:2024' ? 'Essential Cybersecurity Controls' : 'Custom Regulation',
      version: '2024'
    },
    generatedAt: new Date().toISOString(),
    totals,
    controls: controlsWithEvidence
  };
}