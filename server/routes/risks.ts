import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { risks, riskStatus, riskSeverity, type Risk, insertRiskSchema, updateRiskSchema } from "../../shared/risk";
import { tasks } from "../../shared/schema";
import { and, eq, desc, lt, like, or } from "drizzle-orm";
import { emailService } from "../emailService";
import { getUserPermissions } from "../rbac-seed";

const router = Router();

// Helper functions for permissions
async function canEditRisk(user: any): Promise<boolean> {
  const userId = user?.id;
  if (!userId) return false;
  
  const permissions = await getUserPermissions(userId);
  return permissions.includes("edit_risks");
}

async function canViewTask(user: any, task: any): Promise<boolean> {
  // User can view if they're the assignee, creator, or have admin permissions
  const userId = user?.id;
  if (!userId) return false;
  
  // Check if user is assignee or creator
  if (userId === task?.assigneeId || userId === task?.createdById) {
    return true;
  }
  
  // Check if user has admin permissions
  const permissions = await getUserPermissions(userId);
  return permissions.includes("edit_risks") || permissions.includes("view_tasks");
}

// GET /api/risks?status=&severity=&assigneeId=&q=&limit=&cursor=
router.get("/", async (req: any, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const schema = z.object({
      status: z.enum(riskStatus).optional(),
      severity: z.enum(riskSeverity).optional(),
      assigneeId: z.string().optional(),
      q: z.string().optional(),
      limit: z.coerce.number().min(1).max(100).default(50),
      cursor: z.coerce.number().optional(), // risk.id for pagination
    });

    const queryParams = schema.parse(req.query);

    // Get organization from user - assuming organizationId is in user object or null for global admin
    const organizationId = req.user.organizationId || 'default';

    // Build where conditions
    let conditions: any[] = [eq(risks.organizationId, organizationId)];
    
    if (queryParams.status) {
      conditions.push(eq(risks.status, queryParams.status));
    }
    if (queryParams.severity) {
      conditions.push(eq(risks.severity, queryParams.severity));
    }
    if (queryParams.assigneeId) {
      conditions.push(eq(risks.assigneeId, queryParams.assigneeId));
    }
    if (queryParams.q) {
      conditions.push(
        or(
          like(risks.title, `%${queryParams.q}%`),
          like(risks.riskDescription, `%${queryParams.q}%`)
        )
      );
    }
    if (queryParams.cursor) {
      conditions.push(lt(risks.id, queryParams.cursor));
    }

    const rows = await db.select()
      .from(risks)
      .where(and(...conditions))
      .orderBy(desc(risks.id))
      .limit(queryParams.limit);

    res.json({ 
      items: rows, 
      nextCursor: rows.length ? rows[rows.length - 1].id : null 
    });
  } catch (error) {
    console.error("Error fetching risks:", error);
    res.status(500).json({ message: "Failed to fetch risks" });
  }
});

// GET /api/risks/:id - Get individual risk
router.get("/:id", async (req: any, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const organizationId = req.user.organizationId || 'default';

    const [risk] = await db.select()
      .from(risks)
      .where(and(eq(risks.id, id), eq(risks.organizationId, organizationId)));

    if (!risk) {
      return res.status(404).json({ message: "Risk not found" });
    }

    // Check if user can view the associated task
    const [task] = await db.select()
      .from(tasks)
      .where(eq(tasks.id, risk.taskId));

    if (!task || !(await canViewTask(req.user, task))) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(risk);
  } catch (error) {
    console.error("Error fetching risk:", error);
    res.status(500).json({ message: "Failed to fetch risk" });
  }
});

// POST /api/risks/toggle - Toggle risk status on task
router.post("/toggle", async (req: any, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const body = z.object({
      taskId: z.number(),
      makeRisk: z.boolean(),
    }).parse(req.body);

    const organizationId = req.user.organizationId || 'default';

    // Fetch task and verify access
    const [task] = await db.select()
      .from(tasks)
      .where(eq(tasks.id, body.taskId));

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (!(await canViewTask(req.user, task))) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (body.makeRisk) {
      // Set task.isRisk = true
      await db.update(tasks)
        .set({ isRisk: true, updatedAt: new Date() })
        .where(eq(tasks.id, task.id));

      // Create risk if not exists for this task & still open
      const existing = await db.select()
        .from(risks)
        .where(and(
          eq(risks.organizationId, organizationId),
          eq(risks.taskId, task.id),
          eq(risks.isOpen, true)
        ));

      if (existing.length > 0) {
        return res.json(existing[0]);
      }

      const [newRisk] = await db.insert(risks).values({
        organizationId,
        taskId: task.id,
        title: task.title,
        createdById: req.userId,
        status: "not-started" as const,
        severity: "medium" as const,
        isOpen: true,
      }).returning();

      // Optional: notify task assignee
      try {
        if (task.assigneeId && process.env.SENDGRID_API_KEY) {
          await emailService.sendEmailWithRetry({
            to: task.assigneeId, // This should be email, need to fetch user details
            subject: `[Ambersand] Task marked as Risk: ${task.title}`,
            html: `<p>The task <strong>${task.title}</strong> has been marked as a risk and requires attention.</p>
                   <p><a href="${process.env.APP_BASE_URL || "http://localhost:5000"}/risks/${newRisk.id}">View Risk Details</a></p>`,
          });
        }
      } catch (emailError) {
        console.error("Failed to send risk notification email:", emailError);
        // Continue without failing the operation
      }

      return res.status(201).json(newRisk);
    } else {
      // Turn off risk: close open risk(s) & set task.isRisk = false
      await db.update(tasks)
        .set({ isRisk: false, updatedAt: new Date() })
        .where(eq(tasks.id, task.id));

      const [closed] = await db.update(risks)
        .set({
          isOpen: false,
          closedAt: new Date(),
          status: "mitigated" as const,
          updatedAt: new Date(),
        })
        .where(and(
          eq(risks.organizationId, organizationId),
          eq(risks.taskId, task.id),
          eq(risks.isOpen, true)
        ))
        .returning();

      return res.json(closed || { ok: true });
    }
  } catch (error) {
    console.error("Error toggling risk:", error);
    res.status(500).json({ message: "Failed to toggle risk" });
  }
});

// PATCH /api/risks/:id - Edit risk fields (compliance officer/admin only)
router.patch("/:id", async (req: any, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!(await canEditRisk(req.user))) {
      return res.status(403).json({ message: "Only compliance officers and admins can edit risks" });
    }

    const id = Number(req.params.id);
    const organizationId = req.user.organizationId || 'default';
    
    const body = updateRiskSchema.parse(req.body);

    const [updated] = await db.update(risks)
      .set({
        ...(body as any), // Type assertion to handle Drizzle ORM typing issues
        updatedAt: new Date(),
      })
      .where(and(eq(risks.id, id), eq(risks.organizationId, organizationId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ message: "Risk not found" });
    }

    // Send email notification if assignee changed
    if (body.assigneeId && body.assigneeId !== updated.assigneeId) {
      try {
        // TODO: Fetch assignee user details and send email
        console.log("Risk assigned to:", body.assigneeId);
      } catch (emailError) {
        console.error("Failed to send assignment email:", emailError);
      }
    }

    res.json(updated);
  } catch (error) {
    console.error("Error updating risk:", error);
    res.status(500).json({ message: "Failed to update risk" });
  }
});

export default router;