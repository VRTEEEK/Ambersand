import 'dotenv/config';
import { db } from '../db.js';
import { tasks, regulationControls } from '../../shared/schema.js';
import { eq, and } from 'drizzle-orm';

async function fixTaskControl() {
  console.log('🔧 Fixing task to link it to a Cybersecurity Resilience control...');

  // Get the task that needs fixing
  const taskToFix = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, 155));

  if (taskToFix.length === 0) {
    console.log('❌ Task 155 not found');
    process.exit(1);
  }

  console.log(`📊 Current task: ${taskToFix[0].name || 'unnamed'}`);
  console.log(`📊 Current controlId: ${taskToFix[0].controlId}`);

  // Get a Cybersecurity Resilience control to link to
  const resilienceControls = await db
    .select()
    .from(regulationControls)
    .where(and(
      eq(regulationControls.regulationId, 29), // ECC regulation
      eq(regulationControls.mainCategoryEn, 'Cybersecurity Resilience')
    ))
    .limit(1);

  if (resilienceControls.length === 0) {
    console.log('❌ No Cybersecurity Resilience controls found');
    process.exit(1);
  }

  const controlToLinkTo = resilienceControls[0];
  console.log(`🔗 Linking task to control ID: ${controlToLinkTo.id}`);

  // Update the task to link it to this control
  await db
    .update(tasks)
    .set({
      controlId: controlToLinkTo.id,
      name: 'ECC Cybersecurity Resilience Control Task', // Give it a proper name
      updatedAt: new Date()
    })
    .where(eq(tasks.id, 155));

  console.log('✅ Task updated successfully!');

  // Verify the update
  const updatedTask = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, 155));

  console.log(`📊 Updated task controlId: ${updatedTask[0].controlId}`);
  console.log(`📊 Updated task name: ${updatedTask[0].name}`);

  console.log('\n🎉 The dashboard should now show progress for ECC Cybersecurity Resilience!');
  process.exit(0);
}

fixTaskControl().catch(console.error);