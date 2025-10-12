import { Router } from "express";
import { db } from "../db";
import { projects, regulationControls, projectRegulationControls } from "../../shared/schema";
import { eq, inArray, and } from "drizzle-orm";
import { requireAuth } from "../middleware/authMiddleware";

const router = Router();

// Create project from selected controls
router.post("/", requireAuth, async (req: any, res) => {
  try {
    const orgId = req.user?.claims?.org as string;
    const userId = req.user?.id as string;
    const { name, description, regulationId, controlIds, regulationType } = req.body;

    if (!name || !Array.isArray(controlIds) || controlIds.length === 0) {
      return res.status(400).json({ message: "Name and at least one control are required" });
    }

    if (!regulationId) {
      return res.status(400).json({ message: "Regulation ID is required" });
    }

    // Create the project
    const [project] = await db.insert(projects).values({
      name,
      description,
      organizationId: orgId,
      ownerId: userId,
      regulationType: regulationType || 'regulation', // Legacy field
      regulationId: regulationId
    }).returning();

    // Validate controls belong to regulation
    const valid = await db.select({ id: regulationControls.id })
      .from(regulationControls)
      .where(and(
        eq(regulationControls.regulationId, regulationId),
        inArray(regulationControls.id, controlIds)
      ));

    if (valid.length === 0) {
      return res.status(400).json({ message: "No valid controls for this regulation" });
    }

    // Create project control associations
    await db.insert(projectRegulationControls).values(
      valid.map(v => ({ projectId: project.id, controlId: v.id }))
    );

    res.json({ projectId: project.id });
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Get project controls
router.get("/:id/controls", requireAuth, async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    
    const projectControls = await db
      .select({
        id: projectRegulationControls.id,
        status: projectRegulationControls.status,
        assignedTo: projectRegulationControls.assignedTo,
        dueDate: projectRegulationControls.dueDate,
        completedAt: projectRegulationControls.completedAt,
        notes: projectRegulationControls.notes,
        control: regulationControls
      })
      .from(projectRegulationControls)
      .innerJoin(regulationControls, eq(projectRegulationControls.controlId, regulationControls.id))
      .where(eq(projectRegulationControls.projectId, projectId));

    res.json(projectControls);
  } catch (error) {
    console.error("Error fetching project controls:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;