-- Migration: Create ecc_controls view to shadow the old table
-- This view maps the new regulation_controls table back to the old ecc_controls structure
-- for backward compatibility with any raw SQL queries

-- First, ensure the old ecc_controls table is renamed/dropped if it still exists
-- (This should be handled in a separate migration if needed)

-- Create the ecc_controls view
CREATE OR REPLACE VIEW ecc_controls AS
SELECT 
    rc.id,
    rc.clause as code,
    rc.clause as code_ar,
    rc.main_category_en as domain_en,
    rc.main_category_ar as domain_ar,
    rc.sub_category_en as subdomain_en,
    rc.sub_category_ar as subdomain_ar,
    rc.main_control_en as control_en,
    rc.main_control_ar as control_ar,
    rc.main_control_en as title_en,
    rc.main_control_ar as title_ar,
    rc.description_en as implementation_guidance_en,
    rc.description_ar as implementation_guidance_ar,
    rc.evidence_types as evidence_en,
    rc.evidence_types as evidence_ar,
    rc.evidence_types as evidence_required_en,
    rc.evidence_types as evidence_required_ar,
    rc.description_en as requirement_en,
    rc.description_ar as requirement_ar,
    rc.weight,
    rc.created_at
FROM regulation_controls rc
INNER JOIN regulations r ON rc.regulation_id = r.id
WHERE r.code = 'NCA-ECC-2024'
ORDER BY rc.clause;

-- Add comment to explain the view
COMMENT ON VIEW ecc_controls IS 'Backward compatibility view that maps regulation_controls (filtered for NCA-ECC-2024) to the old ecc_controls table structure';