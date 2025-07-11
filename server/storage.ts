import {
  users,
  projects,
  tasks,
  evidence,
  eccControls,
  complianceAssessments,
  controlAssessments,
  type User,
  type UpsertUser,
  type Project,
  type InsertProject,
  type Task,
  type InsertTask,
  type Evidence,
  type InsertEvidence,
  type EccControl,
  type ComplianceAssessment,
  type InsertComplianceAssessment,
  type ControlAssessment,
  type InsertControlAssessment,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, like, or, sql, count } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Project operations
  getProjects(organizationId?: string): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<InsertProject>): Promise<Project>;
  deleteProject(id: number): Promise<void>;
  
  // Task operations
  getTasks(projectId?: number, assigneeId?: string): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, task: Partial<InsertTask>): Promise<Task>;
  deleteTask(id: number): Promise<void>;
  
  // Evidence operations
  getEvidence(projectId?: number, taskId?: number): Promise<Evidence[]>;
  createEvidence(evidence: InsertEvidence): Promise<Evidence>;
  deleteEvidence(id: number): Promise<void>;
  
  // ECC Controls operations
  getEccControls(search?: string): Promise<EccControl[]>;
  getEccControl(id: number): Promise<EccControl | undefined>;
  getEccControlByCode(code: string): Promise<EccControl | undefined>;
  
  // Compliance Assessment operations
  getComplianceAssessments(organizationId?: string): Promise<ComplianceAssessment[]>;
  getComplianceAssessment(id: number): Promise<ComplianceAssessment | undefined>;
  createComplianceAssessment(assessment: InsertComplianceAssessment): Promise<ComplianceAssessment>;
  updateComplianceAssessment(id: number, assessment: Partial<InsertComplianceAssessment>): Promise<ComplianceAssessment>;
  
  // Control Assessment operations
  getControlAssessments(complianceAssessmentId: number): Promise<ControlAssessment[]>;
  createControlAssessment(assessment: InsertControlAssessment): Promise<ControlAssessment>;
  updateControlAssessment(id: number, assessment: Partial<InsertControlAssessment>): Promise<ControlAssessment>;
  
  // Dashboard analytics
  getDashboardMetrics(organizationId?: string): Promise<{
    overallCompliance: number;
    activeProjects: number;
    pendingTasks: number;
    regulationsCovered: number;
    complianceTrend: Array<{ month: string; score: number }>;
    regulationStatus: Array<{ name: string; nameAr: string; progress: number; total: number; percentage: number }>;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Project operations
  async getProjects(organizationId?: string): Promise<Project[]> {
    const query = db.select().from(projects).orderBy(desc(projects.updatedAt));
    
    if (organizationId) {
      return await query.where(eq(projects.organizationId, organizationId));
    }
    
    return await query;
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [newProject] = await db.insert(projects).values(project).returning();
    return newProject;
  }

  async updateProject(id: number, project: Partial<InsertProject>): Promise<Project> {
    const [updatedProject] = await db
      .update(projects)
      .set({ ...project, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return updatedProject;
  }

  async deleteProject(id: number): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  // Task operations
  async getTasks(projectId?: number, assigneeId?: string): Promise<Task[]> {
    let query = db.select().from(tasks).orderBy(desc(tasks.updatedAt));
    
    const conditions = [];
    if (projectId) conditions.push(eq(tasks.projectId, projectId));
    if (assigneeId) conditions.push(eq(tasks.assigneeId, assigneeId));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return await query;
  }

  async getTask(id: number): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [newTask] = await db.insert(tasks).values(task).returning();
    return newTask;
  }

  async updateTask(id: number, task: Partial<InsertTask>): Promise<Task> {
    const [updatedTask] = await db
      .update(tasks)
      .set({ ...task, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return updatedTask;
  }

  async deleteTask(id: number): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  // Evidence operations
  async getEvidence(projectId?: number, taskId?: number): Promise<Evidence[]> {
    let query = db.select().from(evidence).orderBy(desc(evidence.createdAt));
    
    const conditions = [];
    if (projectId) conditions.push(eq(evidence.projectId, projectId));
    if (taskId) conditions.push(eq(evidence.taskId, taskId));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return await query;
  }

  async createEvidence(evidenceData: InsertEvidence): Promise<Evidence> {
    const [newEvidence] = await db.insert(evidence).values(evidenceData).returning();
    return newEvidence;
  }

  async deleteEvidence(id: number): Promise<void> {
    await db.delete(evidence).where(eq(evidence.id, id));
  }

  // ECC Controls operations
  async getEccControls(search?: string): Promise<EccControl[]> {
    let query = db.select().from(eccControls).orderBy(eccControls.code);
    
    if (search) {
      query = query.where(
        or(
          like(eccControls.code, `%${search}%`),
          like(eccControls.domainEn, `%${search}%`),
          like(eccControls.domainAr, `%${search}%`),
          like(eccControls.controlEn, `%${search}%`),
          like(eccControls.controlAr, `%${search}%`)
        )
      );
    }
    
    return await query;
  }

  async getEccControl(id: number): Promise<EccControl | undefined> {
    const [control] = await db.select().from(eccControls).where(eq(eccControls.id, id));
    return control;
  }

  async getEccControlByCode(code: string): Promise<EccControl | undefined> {
    const [control] = await db.select().from(eccControls).where(eq(eccControls.code, code));
    return control;
  }

  // Compliance Assessment operations
  async getComplianceAssessments(organizationId?: string): Promise<ComplianceAssessment[]> {
    const query = db.select().from(complianceAssessments).orderBy(desc(complianceAssessments.updatedAt));
    
    if (organizationId) {
      return await query.where(eq(complianceAssessments.organizationId, organizationId));
    }
    
    return await query;
  }

  async getComplianceAssessment(id: number): Promise<ComplianceAssessment | undefined> {
    const [assessment] = await db.select().from(complianceAssessments).where(eq(complianceAssessments.id, id));
    return assessment;
  }

  async createComplianceAssessment(assessment: InsertComplianceAssessment): Promise<ComplianceAssessment> {
    const [newAssessment] = await db.insert(complianceAssessments).values(assessment).returning();
    return newAssessment;
  }

  async updateComplianceAssessment(id: number, assessment: Partial<InsertComplianceAssessment>): Promise<ComplianceAssessment> {
    const [updatedAssessment] = await db
      .update(complianceAssessments)
      .set({ ...assessment, updatedAt: new Date() })
      .where(eq(complianceAssessments.id, id))
      .returning();
    return updatedAssessment;
  }

  // Control Assessment operations
  async getControlAssessments(complianceAssessmentId: number): Promise<ControlAssessment[]> {
    return await db
      .select()
      .from(controlAssessments)
      .where(eq(controlAssessments.complianceAssessmentId, complianceAssessmentId))
      .orderBy(controlAssessments.id);
  }

  async createControlAssessment(assessment: InsertControlAssessment): Promise<ControlAssessment> {
    const [newAssessment] = await db.insert(controlAssessments).values(assessment).returning();
    return newAssessment;
  }

  async updateControlAssessment(id: number, assessment: Partial<InsertControlAssessment>): Promise<ControlAssessment> {
    const [updatedAssessment] = await db
      .update(controlAssessments)
      .set({ ...assessment, updatedAt: new Date() })
      .where(eq(controlAssessments.id, id))
      .returning();
    return updatedAssessment;
  }

  // Dashboard analytics
  async getDashboardMetrics(organizationId?: string): Promise<{
    overallCompliance: number;
    activeProjects: number;
    pendingTasks: number;
    regulationsCovered: number;
    complianceTrend: Array<{ month: string; score: number }>;
    regulationStatus: Array<{ name: string; nameAr: string; progress: number; total: number; percentage: number }>;
  }> {
    // Get active projects count
    const activeProjectsQuery = db
      .select({ count: count() })
      .from(projects)
      .where(eq(projects.status, "active"));
    
    if (organizationId) {
      activeProjectsQuery.where(eq(projects.organizationId, organizationId));
    }
    
    const [{ count: activeProjects }] = await activeProjectsQuery;

    // Get pending tasks count
    const pendingTasksQuery = db
      .select({ count: count() })
      .from(tasks)
      .where(or(eq(tasks.status, "todo"), eq(tasks.status, "in-progress")));
    
    const [{ count: pendingTasks }] = await pendingTasksQuery;

    // Get total ECC controls count
    const [{ count: totalEccControls }] = await db
      .select({ count: count() })
      .from(eccControls);

    // For demo purposes, calculate compliance based on completed tasks vs total controls
    const [{ count: completedTasks }] = await db
      .select({ count: count() })
      .from(tasks)
      .where(eq(tasks.status, "completed"));

    const overallCompliance = totalEccControls > 0 
      ? Math.round((completedTasks / totalEccControls) * 100)
      : 0;

    // Generate compliance trend data (last 6 months)
    const complianceTrend = [
      { month: "Jul", score: Math.max(0, overallCompliance - 22) },
      { month: "Aug", score: Math.max(0, overallCompliance - 15) },
      { month: "Sep", score: Math.max(0, overallCompliance - 9) },
      { month: "Oct", score: Math.max(0, overallCompliance - 6) },
      { month: "Nov", score: Math.max(0, overallCompliance - 3) },
      { month: "Dec", score: overallCompliance },
    ];

    // Calculate regulation status
    const regulationStatus = [
      {
        name: "ECC (Essential Cybersecurity Controls)",
        nameAr: "الضوابط الأساسية للأمن السيبراني",
        progress: completedTasks,
        total: totalEccControls,
        percentage: totalEccControls > 0 ? Math.round((completedTasks / totalEccControls) * 100) : 0,
      },
      {
        name: "PDPL (Personal Data Protection Law)",
        nameAr: "نظام حماية البيانات الشخصية",
        progress: Math.round(completedTasks * 0.8),
        total: 18,
        percentage: Math.round((completedTasks * 0.8 / 18) * 100),
      },
      {
        name: "NDMO (National Data Management Office)",
        nameAr: "مكتب إدارة البيانات الوطنية",
        progress: Math.round(completedTasks * 0.2),
        total: 25,
        percentage: Math.round((completedTasks * 0.2 / 25) * 100),
      },
    ];

    return {
      overallCompliance,
      activeProjects,
      pendingTasks,
      regulationsCovered: 3,
      complianceTrend,
      regulationStatus,
    };
  }
}

export const storage = new DatabaseStorage();
