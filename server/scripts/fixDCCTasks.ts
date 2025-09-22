import 'dotenv/config';
import { db } from '../db.js';
import { tasks, regulationControls } from '../../shared/schema.js';
import { eq, and } from 'drizzle-orm';

async function fixDCCTasks() {
  console.log('🔧 Fixing DCC tasks to link them to controls...');

  // Get the DCC tasks that need fixing
  const dccTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, 156)); // First DCC task

  const dccTask2 = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, 157)); // Second DCC task

  if (dccTasks.length === 0 || dccTask2.length === 0) {
    console.log('❌ DCC tasks not found');
    process.exit(1);
  }

  // Get controls from different DCC domains
  const cyberDefenseControl = await db
    .select()
    .from(regulationControls)
    .where(and(
      eq(regulationControls.regulationId, 32), // DCC regulation
      eq(regulationControls.mainCategoryEn, 'Cybersecurity Defense')
    ))
    .limit(1);

  const governanceControl = await db
    .select()
    .from(regulationControls)
    .where(and(
      eq(regulationControls.regulationId, 32), // DCC regulation
      eq(regulationControls.mainCategoryEn, 'Cybersecurity Governance')
    ))
    .limit(1);

  if (cyberDefenseControl.length === 0 || governanceControl.length === 0) {
    console.log('❌ DCC controls not found');
    process.exit(1);
  }

  // Update first DCC task to Cybersecurity Defense
  await db
    .update(tasks)
    .set({
      controlId: cyberDefenseControl[0].id,
      name: 'DCC Cybersecurity Defense Task',
      updatedAt: new Date()
    })
    .where(eq(tasks.id, 156));

  console.log(`✅ Task 156 linked to Cybersecurity Defense control ID: ${cyberDefenseControl[0].id}`);

  // Update second DCC task to Cybersecurity Governance
  await db
    .update(tasks)
    .set({
      controlId: governanceControl[0].id,
      name: 'DCC Cybersecurity Governance Task',
      updatedAt: new Date()
    })
    .where(eq(tasks.id, 157));

  console.log(`✅ Task 157 linked to Cybersecurity Governance control ID: ${governanceControl[0].id}`);

  console.log('\n🎉 Both DCC tasks are now linked to controls. The dashboard should show progress!');
  process.exit(0);
}

fixDCCTasks().catch(console.error);