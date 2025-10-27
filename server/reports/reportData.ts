import { db } from "../db";
import { projects, projectRegulationControls, regulationControls, regulations, evidence, evidenceTasks, evidenceControls, tasks, taskRegulationControls, evidenceProjectRegulationControls } from "@shared/schema";
import { eq, and, inArray, or } from "drizzle-orm";
import path from "path";
import { existsSync } from "fs";
import jwt from "jsonwebtoken";

// JWT secret must match what authService uses
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "change-this-secret-in-production";

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
      downloadToken?: string;
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
      .where(projectConditions.length === 1 ? projectConditions[0] : and(...projectConditions))
      .limit(1);

    if (!project[0]) {
      throw new Error(`Project ${projectId} not found or access denied`);
    }

    console.log(`✅ Project found: ${project[0].name}`);
  } catch (error) {
    console.error(`❌ Database error while fetching project ${projectId}:`, error);
    throw new Error(`Failed to retrieve project data: ${error instanceof Error ? error.message : 'Unknown database error'}`);
  }

  // Get project controls with their status and control details using modern regulation system
  let filteredControls;
  let normalizedRegulationCode = regulationCode;
  let firstRegulation: any = null;
  let controls: any[] = [];
  
  try {
    // Normalize regulation code - handle common aliases
    if (regulationCode) {
      const codeAliases: Record<string, string> = {
        'ecc': 'NCA-ECC-2024',
        'ECC': 'NCA-ECC-2024',
        'cscc': 'CSCC-2023',
        'CSCC': 'CSCC-2023',
        'dcc': 'DCC-2022',
        'DCC': 'DCC-2022',
        'crfr': 'CRFR-2023',
        'CRFR': 'CRFR-2023',
        'mvc': 'MVC-2024',
        'MVC': 'MVC-2024'
      };
      normalizedRegulationCode = codeAliases[regulationCode] || regulationCode;
      console.log(`📋 Regulation code normalized: '${regulationCode}' → '${normalizedRegulationCode}'`);
    }
    
    // Use modern regulation controls system only
    const whereConditions = [eq(projectRegulationControls.projectId, projectId)];
    
    if (normalizedRegulationCode) {
      whereConditions.push(eq(regulations.code, normalizedRegulationCode));
    }
    
    const controlsQuery = db.select({
      id: projectRegulationControls.id,
      controlId: projectRegulationControls.controlId,
      status: projectRegulationControls.status,
      assignedTo: projectRegulationControls.assignedTo,
      updatedAt: projectRegulationControls.updatedAt,
      control: regulationControls,
      regulation: regulations
    })
      .from(projectRegulationControls)
      .innerJoin(regulationControls, eq(projectRegulationControls.controlId, regulationControls.id))
      .innerJoin(regulations, eq(regulationControls.regulationId, regulations.id))
      .where(whereConditions.length === 1 ? whereConditions[0] : and(...whereConditions));

    controls = await controlsQuery;
    console.log(`📋 Found ${controls.length} regulation controls for project`);
    
    // Store first regulation for header generation
    if (controls.length > 0) {
      firstRegulation = controls[0].regulation;
    }
    
    filteredControls = controls.map(c => ({
      id: c.id,
      controlId: c.controlId,
      status: c.status,
      assignedTo: c.assignedTo,
      updatedAt: c.updatedAt,
      control: {
        // Map regulation control fields to consistent format
        code: c.control.clause,
        titleEn: c.control.mainControlEn,
        titleAr: c.control.mainControlAr,
        controlEn: c.control.descriptionEn,
        controlAr: c.control.descriptionAr,
        domainEn: c.control.mainCategoryEn,
        domainAr: c.control.mainCategoryAr,
        subdomainEn: c.control.subCategoryEn,
        subdomainAr: c.control.subCategoryAr
      }
    }));

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
        // FIXED: Get ALL evidence linked to this regulation control (works across projects)
        // Need to use the mapping table to find corresponding ECC control IDs
        try {
          console.log(`🔍 Looking for evidence for regulation control ID: ${controlId}`);

          // Try multiple approaches to find evidence for this control
          let allEvidence: any[] = [];

          // Method 1: Try using the ECC mapping table if it exists
          try {
            const mappingResult = await db.execute(
              `SELECT ecc_id FROM ecc_to_regulation_controls_map WHERE regulation_control_id = $1`,
              [controlId]
            );

            if (mappingResult.rows.length > 0) {
              const eccControlIds = mappingResult.rows.map((row: any) => row.ecc_id);
              console.log(`📋 Found ECC mappings for regulation control ${controlId}: ${eccControlIds.join(', ')}`);

              // Get evidence directly linked by eccControlId
              const directEvidence = await db.select({
                id: evidence.id,
                title: evidence.title,
                fileName: evidence.fileName,
                fileType: evidence.fileType,
                fileSize: evidence.fileSize,
                filePath: evidence.filePath,
                description: evidence.description
              })
                .from(evidence)
                .where(inArray(evidence.eccControlId, eccControlIds));

              // Get evidence linked through evidenceControls many-to-many table
              const linkedEvidence = await db.select({
                id: evidence.id,
                title: evidence.title,
                fileName: evidence.fileName,
                fileType: evidence.fileType,
                fileSize: evidence.fileSize,
                filePath: evidence.filePath,
                description: evidence.description
              })
                .from(evidence)
                .innerJoin(evidenceControls, eq(evidence.id, evidenceControls.evidenceId))
                .where(inArray(evidenceControls.eccControlId, eccControlIds));

              allEvidence = [...directEvidence, ...linkedEvidence];
            }
          } catch (mappingError) {
            console.log(`📋 ECC mapping table not available or error: ${mappingError.message}`);
          }

          // Method 2: Fallback - try direct controlId match if mapping didn't work
          if (allEvidence.length === 0) {
            console.log(`📋 Trying direct control ID match for regulation control ${controlId}`);

            // Try evidence directly linked by regulation controlId (if migration updated the field)
            const directRegulatoryEvidence = await db.select({
              id: evidence.id,
              title: evidence.title,
              fileName: evidence.fileName,
              fileType: evidence.fileType,
              fileSize: evidence.fileSize,
              filePath: evidence.filePath,
              description: evidence.description
            })
              .from(evidence)
              .where(eq(evidence.eccControlId, controlId)); // This might work if migration updated the field

            allEvidence = [...allEvidence, ...directRegulatoryEvidence];
          }

          // Remove duplicates
          const uniqueEvidence = allEvidence.filter((ev, index, self) =>
            index === self.findIndex(e => e.id === ev.id)
          );

          controlEvidence = uniqueEvidence;
          console.log(`🔍 Control ${controlData?.code || 'UNKNOWN'}: Found ${controlEvidence.length} evidence files`);

        } catch (directError) {
          console.log(`📋 No direct evidence found for control ${controlData?.code || 'UNKNOWN'}, trying legacy systems`);
          
          // Fallback: Try legacy ECC evidence system if modern system fails
          try {
            const legacyEvidence = await db.select({
              id: evidence.id,
              title: evidence.title,
              fileName: evidence.fileName,
              fileType: evidence.fileType,
              fileSize: evidence.fileSize,
              filePath: evidence.filePath,
              description: evidence.description
            })
              .from(evidence)
              .innerJoin(evidenceControls, eq(evidence.id, evidenceControls.evidenceId))
              .where(eq(evidenceControls.eccControlId, controlId));

            controlEvidence = legacyEvidence;
          } catch (legacyError) {
            console.log(`📋 No legacy evidence found for control ${controlData?.code || 'UNKNOWN'}`);
            controlEvidence = [];
          }
        }

        console.log(`🔍 Control ${controlData?.code || 'UNKNOWN'}: Found ${controlEvidence.length} evidence files (ALL evidence linked to this control across all projects)`);
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

          // Generate signed download token (valid for 30 days for archived reports)
          const downloadToken = jwt.sign(
            { 
              evidenceId: ev.id,
              type: 'download'
            },
            JWT_ACCESS_SECRET,
            { expiresIn: '30d' }
          );

          return {
            id: ev.id,
            title: ev.title,
            fileName: ev.fileName,
            fileType: ev.fileType || null,
            fileSize: ev.fileSize || null,
            filePath: absPath,
            description: ev.description || null,
            downloadToken: downloadToken,
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

  // Build regulation header from actual data
  let regulationHeader;
  if (firstRegulation) {
    // Use regulation data from the first control (all controls should belong to same regulation when filtered)
    regulationHeader = {
      code: firstRegulation.code,
      name: firstRegulation.nameEn,
      version: firstRegulation.version || 'N/A'
    };
  } else if (normalizedRegulationCode) {
    // Fallback for when no controls found but regulation was specified
    regulationHeader = {
      code: normalizedRegulationCode,
      name: 'Unknown Regulation',
      version: 'N/A'
    };
  } else {
    // Default fallback
    regulationHeader = {
      code: 'N/A',
      name: 'No Regulation Specified',
      version: 'N/A'
    };
  }

  return {
    project: {
      id: project[0].id,
      name: project[0].name,
      nameAr: project[0].nameAr,
      organizationId: project[0].organizationId || ''
    },
    regulation: regulationHeader,
    generatedAt: new Date().toISOString(),
    totals,
    controls: controlsWithEvidence
  };
}