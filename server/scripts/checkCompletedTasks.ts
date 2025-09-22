import 'dotenv/config';
import { db } from '../db.js';
import { tasks, regulationControls } from '../../shared/schema.js';
import { eq, and } from 'drizzle-orm';

async function checkCompletedTasks() {
  console.log('🔍 Checking completed tasks...');

  // Get all completed tasks
  const completedTasks = await db
    .select()
    .from(tasks)
    .innerJoin(regulationControls, eq(tasks.controlId, regulationControls.id))
    .where(eq(tasks.status, 'completed'));

  console.log(`📊 Total completed tasks: ${completedTasks.length}`);

  if (completedTasks.length > 0) {
    console.log('\n🔍 Completed tasks breakdown:');
    completedTasks.forEach(task => {
      const control = task.regulation_controls;
      console.log(`  - Task ${task.tasks.id}: ${control.nameEn}`);
      console.log(`    Domain: ${control.mainCategoryEn}`);
      console.log(`    Regulation: ${control.regulationId}`);
    });
  } else {
    console.log('❌ No completed tasks found');
  }

  // Also check for ECC specifically in Cybersecurity Resilience domain
  console.log('\n🔍 Checking ECC Cybersecurity Resilience tasks...');
  const eccCompletedTasks = await db
    .select()
    .from(tasks)
    .innerJoin(regulationControls, eq(tasks.controlId, regulationControls.id))
    .where(and(
      eq(tasks.status, 'completed'),
      eq(regulationControls.regulationId, 1), // Assuming ECC is regulation ID 1
      eq(regulationControls.mainCategoryEn, 'Cybersecurity Resilience')
    ));

  console.log(`📊 ECC Cybersecurity Resilience completed tasks: ${eccCompletedTasks.length}`);

  process.exit(0);
}

checkCompletedTasks().catch(console.error);