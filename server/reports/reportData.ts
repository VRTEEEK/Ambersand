import { db } from "../db";
import { projects, projectControls, eccControls, evidence, tasks, users } from "@shared/schema";
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

  // Get project controls with their status and ECC control details
  let filteredControls;
  try {
    const projectControlsQuery = db.select({
      id: projectControls.id,
      eccControlId: projectControls.eccControlId,
      status: projectControls.status,
      assignedTo: projectControls.assignedTo,
      updatedAt: projectControls.updatedAt,
      eccControl: eccControls
    })
      .from(projectControls)
      .innerJoin(eccControls, eq(projectControls.eccControlId, eccControls.id))
      .where(eq(projectControls.projectId, projectId));

    filteredControls = await projectControlsQuery;
    console.log(`📋 Found ${filteredControls.length} controls for project`);
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
      let controlEvidence: any[] = [];
      try {
        controlEvidence = await db.select()
          .from(evidence)
          .where(eq(evidence.eccControlId, control.eccControlId!));

        console.log(`🔍 Control ${control.eccControl.code}: Found ${controlEvidence.length} evidence files`);
        if (controlEvidence.length > 0) {
          controlEvidence.forEach(ev => {
            console.log(`  📄 Evidence: ${ev.title} (${ev.fileName}) at ${ev.filePath}`);
          });
        }
      } catch (error) {
        console.error(`❌ Error fetching evidence for control ${control.eccControl.code}:`, error);
        // Continue with empty evidence array
        controlEvidence = [];
      }

      return {
        id: control.eccControlId!,
        code: control.eccControl.code,
        title: control.eccControl.titleEn || control.eccControl.controlEn,
        titleAr: control.eccControl.titleAr || control.eccControl.controlAr || null,
        domain: control.eccControl.domainEn,
        subdomain: control.eccControl.subdomainEn || null,
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