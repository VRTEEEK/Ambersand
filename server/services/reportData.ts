import { db } from "../db";
import { projects, projectControls, eccControls, evidence, tasks, users } from "@shared/schema";
import { eq, and } from "drizzle-orm";

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

  // Get project details
  const projectQuery = db.select().from(projects).where(eq(projects.id, projectId));
  
  // Add organization filter only if organizationId is provided
  const project = await (organizationId 
    ? projectQuery.where(eq(projects.organizationId, organizationId))
    : projectQuery
  ).limit(1);

  if (!project[0]) {
    throw new Error(`Project ${projectId} not found or access denied`);
  }

  // Get project controls with their status and ECC control details
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

  let filteredControls = await projectControlsQuery;

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
      const controlEvidence = await db.select()
        .from(evidence)
        .where(eq(evidence.eccControlId, control.eccControlId));

      return {
        id: control.eccControlId,
        code: control.eccControl.code,
        title: control.eccControl.titleEn || control.eccControl.controlEn,
        titleAr: control.eccControl.titleAr || control.eccControl.controlAr || null,
        domain: control.eccControl.domainEn,
        subdomain: control.eccControl.subdomainEn || null,
        status: control.status as 'pending' | 'in-progress' | 'review' | 'completed' | 'blocked',
        approver: control.assignedTo || null,
        updatedAt: control.updatedAt?.toISOString(),
        evidence: controlEvidence.map(ev => ({
          id: ev.id,
          title: ev.title,
          fileName: ev.fileName,
          fileType: ev.fileType || null,
          fileSize: ev.fileSize || null,
          filePath: ev.filePath,
          description: ev.description || null
        }))
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
      organizationId: project[0].organizationId
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