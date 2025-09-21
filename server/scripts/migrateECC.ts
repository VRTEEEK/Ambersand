/**
 * Migrate legacy ecc_controls -> regulations/regulation_controls
 * Maps ECC controls to the generic regulation_controls table with proper column mapping
 *
 * Usage:
 *   tsx server/scripts/migrateECC.ts --dry-run
 *   tsx server/scripts/migrateECC.ts --commit
 */
import 'dotenv/config';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { db } from '../db.js';
import { sql } from 'drizzle-orm';

const argv = yargs(hideBin(process.argv))
  .option('commit', { type: 'boolean', default: false, description: 'Commit changes to database' })
  .option('dry-run', { type: 'boolean', default: true, description: 'Show what would be done without making changes' })
  .help()
  .parseSync();

async function main() {
  const dry = !argv.commit;

  console.log(`🔄 ECC Migration ${dry ? '[DRY-RUN]' : '[COMMIT]'}`);
  console.log('='.repeat(50));

  try {
    // 1) Upsert regulation row for ECC - need to provide required fields from your schema
    console.log('📋 Step 1: Creating/updating ECC regulation entry...');

    const regResult = await db.execute(sql`
      INSERT INTO regulations (
        code,
        name_en,
        name_ar,
        version,
        publisher,
        status,
        org_id,
        created_by
      )
      VALUES (
        'NCA-ECC-2024',
        'National Cybersecurity Controls (ECC-2:2024)',
        'ضوابط الأمن السيبراني الوطنية (ECC-2:2024)',
        '2024',
        'NCA',
        'active',
        'system',
        'migration-script'
      )
      ON CONFLICT (code) DO UPDATE SET
        version = EXCLUDED.version,
        name_en = EXCLUDED.name_en,
        name_ar = EXCLUDED.name_ar
      RETURNING id;
    `);

    const regulationId = (regResult as any).rows?.[0]?.id;
    if (!regulationId) {
      throw new Error('Failed to create/find ECC regulation');
    }
    console.log(`✅ ECC regulation ID: ${regulationId}`);

    // 2) Check if already migrated
    const existingMapCount = await db.execute(sql`
      SELECT COUNT(*) as count FROM ecc_to_regulation_controls_map;
    `);
    const alreadyMigrated = Number((existingMapCount as any).rows[0].count) > 0;

    if (alreadyMigrated) {
      console.log(`⚠️  Migration already completed (${(existingMapCount as any).rows[0].count} mappings found)`);
      if (dry) {
        console.log('📊 Showing existing state...');
      } else {
        console.log('🔄 Re-running migration to ensure consistency...');
      }
    }

    // 3) Read ECC controls
    console.log('📋 Step 2: Reading ECC controls...');
    const eccRows = await db.execute(sql`
      SELECT
        id,
        code,
        domain_en,
        domain_ar,
        subdomain_en,
        subdomain_ar,
        control_en,
        control_ar,
        title_en,
        title_ar,
        implementation_guidance_en,
        implementation_guidance_ar,
        evidence_en,
        evidence_ar,
        evidence_required_en,
        evidence_required_ar,
        requirement_en,
        requirement_ar
      FROM ecc_controls
      ORDER BY id;
    `);

    const total = (eccRows as any).rows.length;
    console.log(`📊 Found ${total} ECC controls to migrate`);

    if (total === 0) {
      console.log('⚠️  No ECC controls found. Migration completed.');
      return;
    }

    // 4) Begin transaction if committing
    if (!dry) {
      await db.execute(sql`BEGIN;`);
      console.log('🔒 Transaction started');
    }

    let inserted = 0;
    let skipped = 0;

    try {
      console.log('📋 Step 3: Migrating controls...');

      for (const [index, r] of ((eccRows as any).rows).entries()) {
        if (index % 50 === 0) {
          console.log(`🔄 Progress: ${index}/${total} (${Math.round((index/total)*100)}%)`);
        }

        // Check if already mapped
        const mapped = await db.execute(sql`
          SELECT regulation_control_id
          FROM ecc_to_regulation_controls_map
          WHERE ecc_id = ${r.id}
        `);

        if ((mapped as any).rows.length > 0) {
          skipped++;
          continue;
        }

        // Prepare evidence types array - combine all evidence fields
        const evidenceFields = [
          r.evidence_en,
          r.evidence_ar,
          r.evidence_required_en,
          r.evidence_required_ar
        ].filter(Boolean);

        const evidenceTypesArray = evidenceFields.length > 0 ? evidenceFields : [];

        if (!dry) {
          // Insert into regulation_controls - handle nulls explicitly
          const insertResult = await db.execute(sql`
            INSERT INTO regulation_controls (
              regulation_id,
              clause,
              main_category_en,
              main_category_ar,
              sub_category_en,
              sub_category_ar,
              main_control_en,
              main_control_ar,
              sub_control_en,
              sub_control_ar,
              description_en,
              description_ar,
              evidence_types,
              weight
            ) VALUES (
              ${regulationId},
              ${r.code || `ECC-${r.id}`},
              ${r.domain_en || ''},
              ${r.domain_ar || ''},
              ${r.subdomain_en || ''},
              ${r.subdomain_ar || ''},
              ${r.control_en || r.title_en || ''},
              ${r.control_ar || r.title_ar || ''},
              ${r.title_en || ''},
              ${r.title_ar || ''},
              ${r.implementation_guidance_en || r.requirement_en || ''},
              ${r.implementation_guidance_ar || r.requirement_ar || ''},
              ${sql.raw(evidenceTypesArray.length > 0 ? `'{${evidenceTypesArray.map(e => e.replace(/'/g, "''")).join(',')}}'` : "'{}'")},
              ${1.0}
            )
            RETURNING id;
          `);

          const newId = (insertResult as any).rows?.[0]?.id;
          if (newId) {
            // Create mapping
            await db.execute(sql`
              INSERT INTO ecc_to_regulation_controls_map (ecc_id, regulation_control_id)
              VALUES (${r.id}, ${newId})
              ON CONFLICT (ecc_id) DO NOTHING;
            `);
            inserted++;
          }
        } else {
          // Dry run - just count what would be inserted
          inserted++;
        }
      }

      console.log(`📊 Migration summary: ${inserted} new mappings, ${skipped} already existed`);

      if (!dry) {
        // 5) Backfill projects.regulation_id where possible
        console.log('📋 Step 4: Backfilling project regulation associations...');

        // Check if project_regulation_controls table exists
        const tableExistsResult = await db.execute(sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_name = 'project_regulation_controls'
          );
        `);

        const tableExists = (tableExistsResult as any).rows[0].exists;

        if (tableExists) {
          const projectUpdateResult = await db.execute(sql`
            WITH project_regulations AS (
              SELECT
                prc.project_id,
                rc.regulation_id,
                COUNT(*) as control_count,
                ROW_NUMBER() OVER (
                  PARTITION BY prc.project_id
                  ORDER BY COUNT(*) DESC
                ) as rn
              FROM project_regulation_controls prc
              JOIN regulation_controls rc ON rc.id = prc.control_id
              WHERE rc.regulation_id IS NOT NULL
              GROUP BY prc.project_id, rc.regulation_id
            )
            UPDATE projects p
            SET regulation_id = pr.regulation_id
            FROM project_regulations pr
            WHERE p.id = pr.project_id
              AND pr.rn = 1
              AND p.regulation_id IS NULL
            RETURNING p.id;
          `);

          const projectsUpdated = (projectUpdateResult as any).rows.length;
          console.log(`✅ Updated ${projectsUpdated} projects with regulation associations`);
        } else {
          console.log('⚠️  project_regulation_controls table not found, skipping project backfill');
        }

        // 6) Migrate legacy join tables
        console.log('📋 Step 5: Migrating legacy join tables...');

        // Update task_controls
        const taskControlsResult = await db.execute(sql`
          UPDATE task_controls tc
          SET regulation_control_id = m.regulation_control_id
          FROM ecc_to_regulation_controls_map m
          WHERE tc.ecc_control_id = m.ecc_id
            AND tc.regulation_control_id IS NULL
          RETURNING tc.id;
        `);

        const taskControlsUpdated = (taskControlsResult as any).rows.length;
        console.log(`✅ Updated ${taskControlsUpdated} task_controls with regulation mappings`);

        // Update evidence_controls
        const evidenceControlsResult = await db.execute(sql`
          UPDATE evidence_controls ec
          SET regulation_control_id = m.regulation_control_id
          FROM ecc_to_regulation_controls_map m
          WHERE ec.ecc_control_id = m.ecc_id
            AND ec.regulation_control_id IS NULL
          RETURNING ec.id;
        `);

        const evidenceControlsUpdated = (evidenceControlsResult as any).rows.length;
        console.log(`✅ Updated ${evidenceControlsUpdated} evidence_controls with regulation mappings`);

        // Commit transaction
        await db.execute(sql`COMMIT;`);
        console.log('✅ Migration committed successfully!');

        // Final verification
        const finalCount = await db.execute(sql`
          SELECT COUNT(*) as count FROM ecc_to_regulation_controls_map;
        `);
        console.log(`🎉 Final mapping count: ${(finalCount as any).rows[0].count}`);

      } else {
        console.log('📋 [DRY-RUN] No changes were made to the database');
        console.log(`📊 Would create ${inserted} new regulation controls and mappings`);
      }

    } catch (error) {
      if (!dry) {
        await db.execute(sql`ROLLBACK;`);
        console.log('🔴 Transaction rolled back due to error');
      }
      throw error;
    }

  } catch (error: any) {
    console.error('🔴 Migration failed:', error?.message || error);
    process.exit(1);
  }

  console.log('='.repeat(50));
  console.log('✅ ECC migration completed successfully!');
}

main().catch(console.error);