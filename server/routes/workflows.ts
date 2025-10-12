import { Router } from "express";
import { db } from "../db";
import { and, eq, asc } from "drizzle-orm";
import { tasks, taskReviewRoute, taskWorkflow, taskWorkflowEvents, users } from "../../shared/schema";
import { requireAuth } from "../middleware/authMiddleware";
// import { emailService } from "../emailService";

const router = Router();

// Helpers
async function getComplianceOfficer(orgId: string) {
  // pick first user with role 'compliance-officer' or 'admin' in org
  const row = await db.query.users.findFirst({
    where: and(
      eq(users.organizationId, orgId), 
      eq(users.role, "admin") // Using admin as compliance officer for now
    ),
  });
  return row;
}

router.get("/:taskId", requireAuth, async (req: any, res) => {
  const orgId = req.user?.organizationId || "default";
  const taskId = Number(req.params.taskId);

  try {
    const [wf] = await db.select().from(taskWorkflow).where(
      and(eq(taskWorkflow.taskId, taskId), eq(taskWorkflow.orgId, orgId))
    );
    
    const route = await db.select().from(taskReviewRoute).where(
      and(eq(taskReviewRoute.taskId, taskId), eq(taskReviewRoute.orgId, orgId))
    ).orderBy(asc(taskReviewRoute.stepIndex));
    
    const history = await db.select().from(taskWorkflowEvents).where(
      and(eq(taskWorkflowEvents.taskId, taskId), eq(taskWorkflowEvents.orgId, orgId))
    ).orderBy(asc(taskWorkflowEvents.createdAt));

    res.json({ workflow: wf, route, history });
  } catch (error) {
    console.error("Get workflow error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Define/replace the review route
router.post("/:taskId/route", requireAuth, async (req: any, res) => {
  const orgId = req.user?.organizationId || "default";
  const taskId = Number(req.params.taskId);
  const steps: Array<{ userId: string; role: string }> = req.body?.steps || [];

  try {
    await db.transaction(async (tx) => {
      // Delete existing route
      await tx.delete(taskReviewRoute).where(
        and(eq(taskReviewRoute.taskId, taskId), eq(taskReviewRoute.orgId, orgId))
      );
      
      // Insert new route steps
      for (let i = 0; i < steps.length; i++) {
        await tx.insert(taskReviewRoute).values({ 
          orgId, 
          taskId, 
          stepIndex: i, 
          userId: steps[i].userId, 
          role: steps[i].role 
        });
      }
      
      // Check if workflow exists, create if not
      const [wf] = await tx.select().from(taskWorkflow).where(
        and(eq(taskWorkflow.taskId, taskId), eq(taskWorkflow.orgId, orgId))
      );
      
      if (!wf) {
        await tx.insert(taskWorkflow).values({ 
          orgId, 
          taskId, 
          state: "collecting", 
          currentStepIndex: 0, 
          currentAssigneeId: steps[0]?.userId 
        });
      }
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("Set route error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Submit to next step / compliance
router.post("/:taskId/submit", requireAuth, async (req: any, res) => {
  const orgId = req.user?.organizationId || "default";
  const actor = req.userId as string;
  const taskId = Number(req.params.taskId);

  try {
    const [wf] = await db.select().from(taskWorkflow).where(
      and(eq(taskWorkflow.taskId, taskId), eq(taskWorkflow.orgId, orgId))
    );
    
    const route = await db.select().from(taskReviewRoute).where(
      and(eq(taskReviewRoute.taskId, taskId), eq(taskReviewRoute.orgId, orgId))
    ).orderBy(asc(taskReviewRoute.stepIndex));

    if (!wf || route.length === 0) {
      return res.status(400).json({ message: "Workflow not configured" });
    }
    
    if (wf.currentAssigneeId && wf.currentAssigneeId !== actor) {
      return res.status(403).json({ message: "Not current assignee" });
    }

    const nextIndex = wf.currentStepIndex + 1;
    let nextAssignee = route[nextIndex]?.userId;

    let newState: any = "in_peer_review";
    if (!nextAssignee) {
      // escalate to compliance
      const compliance = await getComplianceOfficer(orgId);
      if (!compliance) {
        return res.status(400).json({ message: "No compliance officer" });
      }
      nextAssignee = compliance.id;
      newState = "compliance_review";
    }

    await db.transaction(async (tx) => {
      await tx.update(taskWorkflow)
        .set({ 
          state: newState, 
          currentStepIndex: nextIndex, 
          currentAssigneeId: nextAssignee, 
          updatedAt: new Date() 
        })
        .where(and(eq(taskWorkflow.taskId, taskId), eq(taskWorkflow.orgId, orgId)));

      await tx.insert(taskWorkflowEvents).values({
        orgId, taskId, actorId: actor, action: "submit",
        fromStepIndex: wf.currentStepIndex, toStepIndex: nextIndex, toUserId: nextAssignee
      });
    });

    // TODO: notify nextAssignee via email
    // await emailService.send(...)

    res.json({ 
      ok: true, 
      state: newState, 
      currentAssigneeId: nextAssignee, 
      currentStepIndex: nextIndex 
    });
  } catch (error) {
    console.error("Submit workflow error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Return to any previous collaborator
router.post("/:taskId/return", requireAuth, async (req: any, res) => {
  const orgId = req.user?.organizationId || "default";
  const actor = req.userId as string;
  const taskId = Number(req.params.taskId);
  const { toUserId, comment } = req.body || {};

  try {
    const route = await db.select().from(taskReviewRoute).where(
      and(eq(taskReviewRoute.taskId, taskId), eq(taskReviewRoute.orgId, orgId))
    );
    
    const toStep = route.find(r => r.userId === toUserId);
    if (!toStep) {
      return res.status(400).json({ message: "Target user not in route" });
    }

    await db.transaction(async (tx) => {
      await tx.update(taskWorkflow)
        .set({ 
          state: "returned", 
          currentStepIndex: toStep.stepIndex, 
          currentAssigneeId: toUserId, 
          updatedAt: new Date() 
        })
        .where(and(eq(taskWorkflow.taskId, taskId), eq(taskWorkflow.orgId, orgId)));

      await tx.insert(taskWorkflowEvents).values({
        orgId, taskId, actorId: actor, action: "return",
        toStepIndex: toStep.stepIndex, toUserId, comment
      });
    });

    // TODO: emailService: returned notice with comment

    res.json({ ok: true });
  } catch (error) {
    console.error("Return workflow error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Compliance: approve
router.post("/:taskId/approve", requireAuth, async (req: any, res) => {
  const orgId = req.user?.organizationId || "default";
  const actor = req.userId as string;
  const taskId = Number(req.params.taskId);

  try {
    // TODO: verify actor role is compliance officer for org
    await db.transaction(async (tx) => {
      await tx.update(taskWorkflow)
        .set({ state: "approved", updatedAt: new Date() })
        .where(and(eq(taskWorkflow.taskId, taskId), eq(taskWorkflow.orgId, orgId)));
        
      await tx.update(tasks)
        .set({ isEvidenceReady: true })
        .where(eq(tasks.id, taskId));
        
      await tx.insert(taskWorkflowEvents).values({
        orgId, taskId, actorId: actor, action: "approve"
      });
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("Approve workflow error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Compliance: reject (send back to a chosen user)
router.post("/:taskId/reject", requireAuth, async (req: any, res) => {
  const orgId = req.user?.organizationId || "default";
  const actor = req.userId as string;
  const taskId = Number(req.params.taskId);
  const { toUserId, comment } = req.body || {};

  try {
    const route = await db.select().from(taskReviewRoute).where(
      and(eq(taskReviewRoute.taskId, taskId), eq(taskReviewRoute.orgId, orgId))
    );
    
    const toStep = route.find(r => r.userId === toUserId);
    if (!toStep) {
      return res.status(400).json({ message: "Target user not in route" });
    }

    await db.transaction(async (tx) => {
      await tx.update(taskWorkflow)
        .set({ 
          state: "rejected", 
          currentStepIndex: toStep.stepIndex, 
          currentAssigneeId: toUserId, 
          updatedAt: new Date() 
        })
        .where(and(eq(taskWorkflow.taskId, taskId), eq(taskWorkflow.orgId, orgId)));
        
      await tx.insert(taskWorkflowEvents).values({
        orgId, taskId, actorId: actor, action: "reject",
        toUserId, toStepIndex: toStep.stepIndex, comment
      });
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("Reject workflow error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;