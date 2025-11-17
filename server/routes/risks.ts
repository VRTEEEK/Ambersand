import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "../db";
import { risks, riskStatus, riskSeverity, riskAttachments, type Risk, insertRiskSchema, updateRiskSchema, insertRiskAttachmentSchema } from "../../shared/risk";
import { tasks } from "../../shared/schema";
import { and, eq, desc, lt, like, or } from "drizzle-orm";
import { emailService } from "../emailService";
import { getUserPermissions } from "../rbac-seed";

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads", "risk-attachments");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

// Helper functions for permissions
async function canEditRisk(userId: string | number): Promise<boolean> {
  if (!userId) return false;

  const permissions = await getUserPermissions(userId);
  return permissions.includes("edit_risks");
}

async function canViewTask(userId: string | number, task: any): Promise<boolean> {
  // User can view if they're the assignee, creator, or have admin permissions
  if (!userId) return false;

  // Convert both to strings for comparison (since userId is now string after JWT migration)
  const userIdStr = String(userId);
  
  // Check if user is assignee or creator
  if (userIdStr === String(task?.assigneeId) || userIdStr === String(task?.createdById)) {
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

    // Get organization from authenticated user
    const organizationId = req.organizationId || 'default';

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
    const organizationId = req.organizationId || 'default';

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

    if (!task || !(await canViewTask(req.userId!, task))) {
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

    const organizationId = req.organizationId || 'default';

    // Fetch task and verify access
    const [task] = await db.select()
      .from(tasks)
      .where(eq(tasks.id, body.taskId));

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (!(await canViewTask(req.userId!, task))) {
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
          // Fetch assignee user details to get email
          const { users } = await import("../../shared/schema");
          const [assignee] = await db.select()
            .from(users)
            .where(eq(users.id, task.assigneeId));

          if (assignee && assignee.email) {
            await emailService.sendEmailWithRetry({
              to: assignee.email,
              subject: `[Ambersand] Task marked as Risk: ${task.title}`,
              html: `<p>The task <strong>${task.title}</strong> has been marked as a risk and requires attention.</p>
                     <p><a href="${process.env.APP_BASE_URL || "http://localhost:5000"}/risks/${newRisk.id}">View Risk Details</a></p>`,
            });
          }
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

    if (!(await canEditRisk(req.userId!))) {
      return res.status(403).json({ message: "Only compliance officers and admins can edit risks" });
    }

    const id = Number(req.params.id);
    const organizationId = req.organizationId || 'default';
    
    const body = updateRiskSchema.parse(req.body);

    // Get the old risk record before updating to check for assignee changes
    const [oldRisk] = await db.select()
      .from(risks)
      .where(and(eq(risks.id, id), eq(risks.organizationId, organizationId)));

    if (!oldRisk) {
      return res.status(404).json({ message: "Risk not found" });
    }

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
    if (body.assigneeId && body.assigneeId !== oldRisk.assigneeId) {
      try {
        // Fetch assignee user details to get email
        const { users } = await import("../../shared/schema");
        const [assignee] = await db.select()
          .from(users)
          .where(eq(users.id, body.assigneeId));

        if (assignee && assignee.email && process.env.SENDGRID_API_KEY) {
          const { getUserById } = await import("../storage");
          const storage = (await import("../storage")).default;
          const creatorUser = await storage.getUserById(oldRisk.createdById);

          await emailService.sendEmailWithRetry({
            to: assignee.email,
            subject: `[Ambersand] Risk Assigned: ${updated.title}`,
            html: `<p>You have been assigned to a risk: <strong>${updated.title}</strong></p>
                   <p><strong>Severity:</strong> ${updated.severity}</p>
                   <p><strong>Status:</strong> ${updated.status}</p>
                   <p><strong>Created by:</strong> ${creatorUser?.firstName || 'Unknown'} ${creatorUser?.lastName || ''}</p>
                   <p><a href="${process.env.APP_BASE_URL || "http://localhost:5000"}/risks/${updated.id}">View Risk Details</a></p>`,
          });
        }
      } catch (emailError) {
        console.error("Failed to send assignment email:", emailError);
        // Continue without failing the operation
      }
    }

    res.json(updated);
  } catch (error) {
    console.error("Error updating risk:", error);
    res.status(500).json({ message: "Failed to update risk" });
  }
});

// GET /api/risks/:id/attachments - List all attachments for a risk
router.get("/:id/attachments", async (req: any, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const riskId = Number(req.params.id);
    const organizationId = req.organizationId || 'default';

    // Verify risk exists and user has access
    const [risk] = await db.select()
      .from(risks)
      .where(and(eq(risks.id, riskId), eq(risks.organizationId, organizationId)));

    if (!risk) {
      return res.status(404).json({ message: "Risk not found" });
    }

    // Get all attachments for this risk
    const attachments = await db.select()
      .from(riskAttachments)
      .where(eq(riskAttachments.riskId, riskId))
      .orderBy(desc(riskAttachments.uploadedAt));

    res.json(attachments);
  } catch (error) {
    console.error("Error fetching risk attachments:", error);
    res.status(500).json({ message: "Failed to fetch attachments" });
  }
});

// POST /api/risks/:id/attachments - Upload an attachment for a risk
router.post("/:id/attachments", upload.single("file"), async (req: any, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file provided" });
    }

    const riskId = Number(req.params.id);
    const organizationId = req.organizationId || 'default';

    // Verify risk exists and user has access
    const [risk] = await db.select()
      .from(risks)
      .where(and(eq(risks.id, riskId), eq(risks.organizationId, organizationId)));

    if (!risk) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: "Risk not found" });
    }

    // Save attachment metadata to database
    const [attachment] = await db.insert(riskAttachments).values({
      riskId,
      fileName: req.file.originalname,
      filePath: req.file.path,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedById: req.userId,
    }).returning();

    res.status(201).json(attachment);
  } catch (error) {
    console.error("Error uploading risk attachment:", error);
    // Clean up file if it was uploaded
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error("Error cleaning up file:", cleanupError);
      }
    }
    res.status(500).json({ message: "Failed to upload attachment" });
  }
});

// GET /api/risks/attachments/:id/download - Download a specific attachment
router.get("/attachments/:id/download", async (req: any, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const attachmentId = Number(req.params.id);

    // Get attachment metadata
    const [attachment] = await db.select()
      .from(riskAttachments)
      .where(eq(riskAttachments.id, attachmentId));

    if (!attachment) {
      return res.status(404).json({ message: "Attachment not found" });
    }

    // Verify risk access
    const organizationId = req.organizationId || 'default';
    const [risk] = await db.select()
      .from(risks)
      .where(and(eq(risks.id, attachment.riskId), eq(risks.organizationId, organizationId)));

    if (!risk) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Check if file exists
    if (!fs.existsSync(attachment.filePath)) {
      return res.status(404).json({ message: "File not found on server" });
    }

    // Send file
    res.download(attachment.filePath, attachment.fileName);
  } catch (error) {
    console.error("Error downloading risk attachment:", error);
    res.status(500).json({ message: "Failed to download attachment" });
  }
});

// DELETE /api/risks/attachments/:id - Delete a specific attachment
router.delete("/attachments/:id", async (req: any, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const attachmentId = Number(req.params.id);

    // Get attachment metadata
    const [attachment] = await db.select()
      .from(riskAttachments)
      .where(eq(riskAttachments.id, attachmentId));

    if (!attachment) {
      return res.status(404).json({ message: "Attachment not found" });
    }

    // Verify risk access
    const organizationId = req.organizationId || 'default';
    const [risk] = await db.select()
      .from(risks)
      .where(and(eq(risks.id, attachment.riskId), eq(risks.organizationId, organizationId)));

    if (!risk) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Delete file from filesystem
    if (fs.existsSync(attachment.filePath)) {
      fs.unlinkSync(attachment.filePath);
    }

    // Delete from database
    await db.delete(riskAttachments)
      .where(eq(riskAttachments.id, attachmentId));

    res.json({ success: true, message: "Attachment deleted successfully" });
  } catch (error) {
    console.error("Error deleting risk attachment:", error);
    res.status(500).json({ message: "Failed to delete attachment" });
  }
});

export default router;