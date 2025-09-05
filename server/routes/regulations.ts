import { Router } from "express";
import { db } from "../db";
import { regulations, regulationControls } from "../../shared/schema";
import { and, eq, asc } from "drizzle-orm";
import { isAuthenticated } from "../replitAuth";
import { requirePermissions } from "../rbac-middleware";

const router = Router();

// GET one regulation + controls (with optional filters)
router.get("/:id", isAuthenticated, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const reg = await db.query.regulations.findFirst({ where: eq(regulations.id, id) });
    if (!reg) return res.status(404).json({ message: "Regulation not found" });

    const controls = await db.select().from(regulationControls)
      .where(eq(regulationControls.regulationId, id))
      .orderBy(asc(regulationControls.mainCategoryEn), asc(regulationControls.subCategoryEn), asc(regulationControls.clause));
    res.json({ regulation: reg, controls });
  } catch (error) {
    console.error("Error fetching regulation:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH regulation metadata  
router.patch("/:id", isAuthenticated, requirePermissions(['edit_regulations']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { code, nameEn, nameAr, version, publisher, status } = req.body;
    await db.update(regulations).set({ code, nameEn, nameAr, version, publisher, status }).where(eq(regulations.id, id));
    const updated = await db.query.regulations.findFirst({ where: eq(regulations.id, id) });
    res.json(updated);
  } catch (error) {
    console.error("Error updating regulation:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH a single control
router.patch("/:id/controls/:controlId", isAuthenticated, requirePermissions(['edit_regulations']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const controlId = Number(req.params.controlId);
    const patch = req.body; // allow editing desc/evidenceTypes/weight etc.
    await db.update(regulationControls).set(patch)
      .where(and(eq(regulationControls.id, controlId), eq(regulationControls.regulationId, id)));
    const updated = await db.query.regulationControls.findFirst({ where: eq(regulationControls.id, controlId) });
    res.json(updated);
  } catch (error) {
    console.error("Error updating control:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;