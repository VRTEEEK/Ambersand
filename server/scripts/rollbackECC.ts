/**
 * Rollback ECC migration - safely removes migrated data
 * This script reverses the ECC migration by removing regulation_controls
 * that were migrated from ecc_controls and clearing the mapping table.
 *
 * Usage:
 *   tsx server/scripts/rollbackECC.ts --dry-run
 *   tsx server/scripts/rollbackECC.ts --commit
 *   tsx server/scripts/rollbackECC.ts --commit --drop-regulation
 */
import 'dotenv/config';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { db } from '../db.js';
import { sql } from 'drizzle-orm';

const argv = yargs(hideBin(process.argv))
  .option('commit', {
    type: 'boolean',
    default: false,
    description: 'Commit rollback changes to database'
  })
  .option('dry-run', {
    type: 'boolean',
    default: true,
    description: 'Show what would be rolled back without making changes'
  })
  .option('drop-regulation', {
    type: 'boolean',
    default: false,
    description: 'Also remove the ECC regulation record (dangerous!)'
  })
  .option('force', {
    type: 'boolean',
    default: false,
    description: 'Skip confirmation prompts'
  })
  .help()
  .parseSync();

async function confirmAction(message: string): Promise<boolean> {
  if (argv.force) return true;

  console.log(`⚠️  ${message}`);
  console.log('   Type "yes" to continue, or anything else to abort:');

  // In a real CLI environment, you would use readline or similar
  // For this script, we'll require the --force flag for non-interactive use
  if (!argv.force) {
    console.log('🛑 Rollback aborted. Use --force flag to skip confirmation.');
    return false;
  }

  return true;
}

async function main() {
  const dry = !argv.commit;

  console.log(`🔄 ECC Rollback ${dry ? '[DRY-RUN]' : '[COMMIT]'}`);
  console.log('='.repeat(50));

  try {
    // 1) Find ECC regulation
    console.log('🔍 Step 1: Finding ECC regulation...');
    const eccRegResult = await db.execute(sql`
      SELECT id, code, name_en FROM regulations
      WHERE code = 'NCA-ECC-2024'
      LIMIT 1;
    `);

    if ((eccRegResult as any).rows.length === 0) {
      console.log('✅ No ECC regulation found. Nothing to rollback.');
      return;
    }

    const eccRegulation = (eccRegResult as any).rows[0];
    console.log(`📋 Found ECC regulation: ${eccRegulation.code} (ID: ${eccRegulation.id})`);

    // 2) Check mapping table
    console.log('🔍 Step 2: Checking migration mappings...');
    const mappingCountResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM ecc_to_regulation_controls_map;
    `);

    const mappingCount = Number((mappingCountResult as any).rows[0].count);
    console.log(`📊 Found ${mappingCount} ECC control mappings`);

    if (mappingCount === 0) {
      console.log('✅ No migration mappings found. Nothing to rollback.');
      if (argv['drop-regulation']) {
        console.log('🗑️  Will still remove regulation record if requested...');
      } else {
        return;
      }
    }

    // 3) Check dependent data
    console.log('🔍 Step 3: Checking dependent data...');

    const dependencyChecks = await Promise.all([
      // Check projects using this regulation
      db.execute(sql`
        SELECT COUNT(*) as count FROM projects
        WHERE regulation_id = ${eccRegulation.id};
      `),
      // Check task_controls with regulation mappings
      db.execute(sql`
        SELECT COUNT(*) as count FROM task_controls tc
        WHERE EXISTS (
          SELECT 1 FROM ecc_to_regulation_controls_map m
          WHERE m.regulation_control_id = tc.regulation_control_id
        );
      `),
      // Check evidence_controls with regulation mappings
      db.execute(sql`
        SELECT COUNT(*) as count FROM evidence_controls ec
        WHERE EXISTS (
          SELECT 1 FROM ecc_to_regulation_controls_map m
          WHERE m.regulation_control_id = ec.regulation_control_id
        );
      `),
      // Check project_regulation_controls
      db.execute(sql`
        SELECT COUNT(*) as count FROM project_regulation_controls prc
        WHERE EXISTS (
          SELECT 1 FROM ecc_to_regulation_controls_map m
          WHERE m.regulation_control_id = prc.control_id
        );
      `)
    ]);

    const [projectsCount, taskControlsCount, evidenceControlsCount, projectRegControlsCount] = dependencyChecks.map(
      result => Number((result as any).rows[0].count)
    );

    console.log(`📊 Dependencies found:`);
    console.log(`   📁 Projects: ${projectsCount}`);
    console.log(`   📋 Task controls: ${taskControlsCount}`);
    console.log(`   📎 Evidence controls: ${evidenceControlsCount}`);
    console.log(`   🔗 Project regulation controls: ${projectRegControlsCount}`);

    const hasDependencies = projectsCount > 0 || taskControlsCount > 0 || evidenceControlsCount > 0 || projectRegControlsCount > 0;

    if (hasDependencies && !dry) {
      const confirmed = await confirmAction(
        'This rollback will affect existing projects and tasks. This action cannot be undone!'
      );
      if (!confirmed) {
        process.exit(0);
      }
    }

    // 4) Perform rollback
    if (!dry) {
      await db.execute(sql`BEGIN;`);
      console.log('🔒 Transaction started');
    }

    let rollbackStats = {
      projectsCleared: 0,
      taskControlsCleared: 0,
      evidenceControlsCleared: 0,
      projectRegControlsDeleted: 0,
      regulationControlsDeleted: 0,
      mappingsCleared: 0,
      regulationDeleted: false
    };

    try {
      if (mappingCount > 0) {
        console.log('🔄 Step 4: Rolling back dependent data...');

        if (!dry) {
          // Clear projects.regulation_id where it points to ECC
          const projectsClearResult = await db.execute(sql`
            UPDATE projects
            SET regulation_id = NULL
            WHERE regulation_id = ${eccRegulation.id}
            RETURNING id;
          `);
          rollbackStats.projectsCleared = (projectsClearResult as any).rows.length;

          // Clear task_controls.regulation_control_id for migrated controls
          const taskControlsClearResult = await db.execute(sql`
            UPDATE task_controls
            SET regulation_control_id = NULL
            WHERE regulation_control_id IN (
              SELECT regulation_control_id FROM ecc_to_regulation_controls_map
            )
            RETURNING id;
          `);
          rollbackStats.taskControlsCleared = (taskControlsClearResult as any).rows.length;

          // Clear evidence_controls.regulation_control_id for migrated controls
          const evidenceControlsClearResult = await db.execute(sql`
            UPDATE evidence_controls
            SET regulation_control_id = NULL
            WHERE regulation_control_id IN (
              SELECT regulation_control_id FROM ecc_to_regulation_controls_map
            )
            RETURNING id;
          `);
          rollbackStats.evidenceControlsCleared = (evidenceControlsClearResult as any).rows.length;

          // Delete project_regulation_controls for migrated controls
          const projectRegControlsResult = await db.execute(sql`
            DELETE FROM project_regulation_controls
            WHERE control_id IN (
              SELECT regulation_control_id FROM ecc_to_regulation_controls_map
            )
            RETURNING id;
          `);
          rollbackStats.projectRegControlsDeleted = (projectRegControlsResult as any).rows.length;
        } else {
          // Dry run estimates
          rollbackStats.projectsCleared = projectsCount;
          rollbackStats.taskControlsCleared = taskControlsCount;
          rollbackStats.evidenceControlsCleared = evidenceControlsCount;
          rollbackStats.projectRegControlsDeleted = projectRegControlsCount;
        }

        console.log('🔄 Step 5: Removing migrated regulation controls...');

        if (!dry) {
          // Delete regulation_controls that were migrated from ECC
          const regulationControlsResult = await db.execute(sql`
            DELETE FROM regulation_controls
            WHERE id IN (
              SELECT regulation_control_id FROM ecc_to_regulation_controls_map
            )
            RETURNING id;
          `);
          rollbackStats.regulationControlsDeleted = (regulationControlsResult as any).rows.length;

          // Clear the mapping table
          const mappingClearResult = await db.execute(sql`
            DELETE FROM ecc_to_regulation_controls_map
            RETURNING ecc_id;
          `);
          rollbackStats.mappingsCleared = (mappingClearResult as any).rows.length;
        } else {
          rollbackStats.regulationControlsDeleted = mappingCount;
          rollbackStats.mappingsCleared = mappingCount;
        }
      }

      // 6) Remove regulation if requested
      if (argv['drop-regulation']) {
        console.log('🔄 Step 6: Removing ECC regulation record...');

        if (!dry) {
          const confirmed = await confirmAction(
            'You are about to DELETE the ECC regulation record. This is irreversible!'
          );
          if (confirmed) {
            await db.execute(sql`
              DELETE FROM regulations
              WHERE id = ${eccRegulation.id};
            `);
            rollbackStats.regulationDeleted = true;
          }
        } else {
          rollbackStats.regulationDeleted = true; // Would delete
        }
      }

      // 7) Remove read-only trigger
      console.log('🔄 Step 7: Removing read-only trigger...');
      if (!dry) {
        await db.execute(sql`
          DROP TRIGGER IF EXISTS trg_ecc_controls_readonly ON ecc_controls;
          DROP FUNCTION IF EXISTS ecc_controls_readonly();
        `);
      }

      console.log('\n📊 Rollback Summary:');
      console.log(`   📁 Projects cleared: ${rollbackStats.projectsCleared}`);
      console.log(`   📋 Task controls cleared: ${rollbackStats.taskControlsCleared}`);
      console.log(`   📎 Evidence controls cleared: ${rollbackStats.evidenceControlsCleared}`);
      console.log(`   🔗 Project regulation controls deleted: ${rollbackStats.projectRegControlsDeleted}`);
      console.log(`   🎯 Regulation controls deleted: ${rollbackStats.regulationControlsDeleted}`);
      console.log(`   🗂️  Mappings cleared: ${rollbackStats.mappingsCleared}`);
      console.log(`   🗑️  Regulation deleted: ${rollbackStats.regulationDeleted ? 'Yes' : 'No'}`);

      if (!dry) {
        await db.execute(sql`COMMIT;`);
        console.log('\n✅ Rollback committed successfully!');
        console.log('🔓 ECC controls table is now writable again.');
      } else {
        console.log('\n📋 [DRY-RUN] No changes were made to the database');
      }

    } catch (error) {
      if (!dry) {
        await db.execute(sql`ROLLBACK;`);
        console.log('🔴 Transaction rolled back due to error');
      }
      throw error;
    }

  } catch (error: any) {
    console.error('🔴 Rollback failed:', error?.message || error);
    process.exit(1);
  }

  console.log('='.repeat(50));
  console.log('✅ ECC rollback completed successfully!');

  if (!dry && !argv['drop-regulation']) {
    console.log('\n💡 Note: The ECC regulation record was preserved.');
    console.log('   Use --drop-regulation flag if you want to remove it completely.');
  }
}

main().catch(console.error);