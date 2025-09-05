import { Router } from "express";
import { db } from "../db";
import { projects, regulationControls } from "../../shared/schema";
import { eq, inArray, and } from "drizzle-orm";
import { isAuthenticated } from "../replitAuth";

const router = Router();

// Create project from selected controls (using existing projects table structure)
router.post("/", isAuthenticated, async (req: any, res) => {
  try {
    const orgId = req.user?.claims?.org as string;
    const userId = req.user?.id as string;
    const { name, description, regulationId, controlIds } = req.body;

    if (!name || !Array.isArray(controlIds) || controlIds.length === 0) {
      return res.status(400).json({ message: "Name and at least one control are required" });
    }

    // For now, create a basic project using existing structure
    // We'll enhance this once the new schema is fully deployed
    const inserted = await db.insert(projects).values({ 
      name, 
      description, 
      organizationId: orgId, 
      ownerId: userId,
      regulationType: 'regulation' // Use generic type for new regulation projects
    }).returning();
    const project = inserted[0];

    // TODO: Once regulation_controls table is available, create projectControls entries
    // For now, just return the project ID
    res.json({ projectId: project.id });
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Get project controls (placeholder for now)
router.get("/:id/controls", isAuthenticated, async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    // TODO: Once projectControls table references regulationControls, implement this
    res.json([]);
  } catch (error) {
    console.error("Error fetching project controls:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;