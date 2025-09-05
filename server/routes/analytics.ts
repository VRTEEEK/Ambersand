import { Router } from "express";
import { db } from "../db";
import { tasks, projects, users, taskControls, eccControls } from "@shared/schema";
import { and, eq, inArray, sql, lt, gt, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// Analytics endpoint for task metrics with filtering
router.get("/tasks", async (req: any, res) => {
  try {
    const org = req.user?.claims?.org || req.user?.organizationId || 'default';
    if (!org) {
      return res.status(400).json({ message: "Organization missing" });
    }

    // Parse query parameters
    const querySchema = z.object({
      projectIds: z.string().optional(),
      regulationIds: z.string().optional(), 
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    });

    const query = querySchema.parse(req.query);

    const projectIds = query.projectIds 
      ? query.projectIds.split(",").filter(Boolean).map(Number)
      : [];
    
    const regulationIds = query.regulationIds
      ? query.regulationIds.split(",").filter(Boolean)
      : [];

    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : null;
    const dateTo = query.dateTo ? new Date(query.dateTo) : null;

    // Build base where conditions - scope by organization through projects
    const buildBaseWhere = async () => {
      const wheres: any[] = [];
      
      // Get all projects in this organization to scope tasks
      const orgProjects = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.organizationId, org));
      
      const orgProjectIds = orgProjects.map(p => p.id);
      
      if (orgProjectIds.length > 0) {
        wheres.push(inArray(tasks.projectId, orgProjectIds));
      } else {
        // No projects in org, return no tasks
        wheres.push(sql`false`);
      }
      
      if (projectIds.length > 0) {
        // Further filter by specific requested projects
        wheres.push(inArray(tasks.projectId, projectIds));
      }
      
      if (dateFrom) {
        wheres.push(gt(tasks.createdAt, dateFrom));
      }
      
      if (dateTo) {
        wheres.push(lt(tasks.createdAt, dateTo));
      }

      return and(...wheres);
    };

    // Handle regulation filtering (via project regulation types)
    let filteredTaskIds: number[] | null = null;
    if (regulationIds.length > 0) {
      const filteredProjects = await db
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(
            eq(projects.organizationId, org),
            inArray(projects.regulationType, regulationIds)
          )
        );
      
      const filteredProjectIds = filteredProjects.map(p => p.id);
      
      if (filteredProjectIds.length > 0) {
        const taskRows = await db
          .select({ id: tasks.id })
          .from(tasks)
          .where(
            and(
              await buildBaseWhere(),
              inArray(tasks.projectId, filteredProjectIds)
            )
          );
        filteredTaskIds = taskRows.map(t => t.id);
      } else {
        filteredTaskIds = [];
      }
    }

    const baseWhere = await buildBaseWhere();
    const finalWhere = filteredTaskIds !== null 
      ? and(baseWhere, filteredTaskIds.length > 0 ? inArray(tasks.id, filteredTaskIds) : sql`false`)
      : baseWhere;

    // If no tasks match the regulation filter, return empty result
    if (filteredTaskIds !== null && filteredTaskIds.length === 0) {
      return res.json({
        totals: {
          all: 0,
          byStatus: {},
          overdue: 0,
          completedToday: 0,
        },
        byProject: [],
        byRegulation: [],
        byAssignee: [],
        dateRange: { from: query.dateFrom, to: query.dateTo }
      });
    }

    // 1. Total count
    const [totalResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tasks)
      .where(finalWhere);
    
    const totalCount = Number(totalResult?.count || 0);

    // 2. By Status
    const byStatusRows = await db
      .select({
        status: tasks.status,
        count: sql<number>`COUNT(*)`
      })
      .from(tasks)
      .where(finalWhere)
      .groupBy(tasks.status);

    const byStatusMap = Object.fromEntries(
      byStatusRows.map(row => [row.status, Number(row.count)])
    );

    // 3. Overdue tasks (due date passed and not completed)
    const [overdueResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tasks)
      .where(
        and(
          finalWhere,
          isNotNull(tasks.dueDate),
          lt(tasks.dueDate, sql`CURRENT_DATE`),
          sql`${tasks.status} NOT IN ('completed', 'review')`
        )
      );
    
    const overdueCount = Number(overdueResult?.count || 0);

    // 4. Completed today
    const [completedTodayResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tasks)
      .where(
        and(
          finalWhere,
          sql`${tasks.status} = 'completed'`,
          sql`DATE(${tasks.completedAt}) = CURRENT_DATE`
        )
      );
    
    const completedTodayCount = Number(completedTodayResult?.count || 0);

    // 5. By Project (with project names)
    const byProjectRows = await db
      .select({
        projectId: tasks.projectId,
        projectName: projects.name,
        count: sql<number>`COUNT(*)`
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(finalWhere)
      .groupBy(tasks.projectId, projects.name);

    const byProject = byProjectRows.map(row => ({
      projectId: row.projectId || 0,
      name: row.projectName || 'Unassigned',
      count: Number(row.count)
    }));

    // 6. By Regulation (via project regulation types)
    const byRegulationRows = await db
      .select({
        regulationType: projects.regulationType,
        count: sql<number>`COUNT(*)`
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(and(finalWhere, isNotNull(projects.regulationType)))
      .groupBy(projects.regulationType);

    const byRegulation = byRegulationRows.map(row => ({
      regulationId: row.regulationType || 'unknown',
      code: row.regulationType || 'unknown',
      count: Number(row.count)
    }));

    // 7. By Assignee (with user names)
    const byAssigneeRows = await db
      .select({
        assigneeId: tasks.assigneeId,
        userName: users.name,
        userEmail: users.email,
        count: sql<number>`COUNT(*)`
      })
      .from(tasks)
      .leftJoin(users, eq(tasks.assigneeId, users.id))
      .where(finalWhere)
      .groupBy(tasks.assigneeId, users.name, users.email);

    const byAssignee = byAssigneeRows.map(row => ({
      userId: row.assigneeId || 'unassigned',
      name: row.userName || row.userEmail || 'Unassigned',
      count: Number(row.count)
    }));

    // 8. By Severity/Priority
    const bySeverityRows = await db
      .select({
        priority: tasks.priority,
        count: sql<number>`COUNT(*)`
      })
      .from(tasks)
      .where(finalWhere)
      .groupBy(tasks.priority);

    const bySeverity = bySeverityRows.map(row => ({
      severity: row.priority,
      count: Number(row.count)
    }));

    res.json({
      totals: {
        all: totalCount,
        byStatus: byStatusMap,
        overdue: overdueCount,
        completedToday: completedTodayCount,
      },
      byProject,
      byRegulation,
      byAssignee,
      bySeverity,
      dateRange: { from: query.dateFrom, to: query.dateTo }
    });

  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ message: "Failed to fetch analytics data" });
  }
});

export default router;