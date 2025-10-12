import { Router } from "express";
import { db } from "../db";
import { regulations, regulationControls } from "../../shared/schema";
import { and, eq, asc, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/authMiddleware";
import { requirePermissions } from "../rbac-middleware";

const router = Router();

// GET one regulation + controls (with optional filters)
router.get("/:id", requireAuth, async (req, res) => {
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
router.patch("/:id", requireAuth, requirePermissions(['edit_regulations']), async (req, res) => {
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

// PATCH a single control (with field validation)
router.patch("/:id/controls/:controlId", requireAuth, requirePermissions(['edit_regulations']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const controlId = Number(req.params.controlId);
    const patch = req.body;

    // Server-side input guard - only allow specific fields
    const allowed = [
      "mainCategoryEn", "mainCategoryAr", "subCategoryEn", "subCategoryAr",
      "mainControlEn", "mainControlAr", "subControlEn", "subControlAr",
      "descriptionEn", "descriptionAr", "evidenceTypes", "weight"
    ];
    const update: any = {};
    for (const k of allowed) {
      if (k in patch) update[k] = patch[k];
    }

    await db.update(regulationControls).set(update)
      .where(and(eq(regulationControls.id, controlId), eq(regulationControls.regulationId, id)));

    const updated = await db.query.regulationControls.findFirst({ where: eq(regulationControls.id, controlId) });
    res.json(updated);
  } catch (error) {
    console.error("Error updating control:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET distinct domains for one regulation
router.get("/:id/domains", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await db.execute(sql`
      SELECT DISTINCT main_category_en AS "mainCategoryEn", main_category_ar AS "mainCategoryAr"
      FROM regulation_controls WHERE regulation_id = ${id}
      ORDER BY 1 NULLS LAST
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching domains:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET distinct subdomains for one regulation (filtered by domain)
router.get("/:id/subdomains", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const domainEn = req.query.domainEn as string | undefined;
    const domainAr = req.query.domainAr as string | undefined;

    const result = await db.execute(sql`
      SELECT DISTINCT sub_category_en AS "subCategoryEn", sub_category_ar AS "subCategoryAr"
      FROM regulation_controls
      WHERE regulation_id = ${id}
        AND (${domainEn ? sql`main_category_en = ${domainEn}` : sql`1=1`})
        AND (${domainAr ? sql`main_category_ar = ${domainAr}` : sql`1=1`})
      ORDER BY 1 NULLS LAST
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching subdomains:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;