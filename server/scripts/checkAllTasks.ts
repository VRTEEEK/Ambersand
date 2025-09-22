import 'dotenv/config';
import { db } from '../db.js';
import { tasks, regulationControls } from '../../shared/schema.js';
import { eq, and } from 'drizzle-orm';

async function checkAllTasks() {
  console.log('🔍 Checking all tasks...');

  // Get all tasks with their status
  const allTasks = await db
    .select()
    .from(tasks)
    .innerJoin(regulationControls, eq(tasks.controlId, regulationControls.id))
    .orderBy(tasks.status);

  console.log(`📊 Total tasks: ${allTasks.length}`);

  if (allTasks.length > 0) {
    const statusCounts = {};
    console.log('\n🔍 Tasks by status:');

    allTasks.forEach(task => {
      const status = task.tasks.status;
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      const control = task.regulation_controls;
      if (control.mainCategoryEn === 'Cybersecurity Resilience') {
        console.log(`  - Task ${task.tasks.id}: ${control.nameEn} (${status})`);
        console.log(`    Domain: ${control.mainCategoryEn}`);
      }
    });

    console.log('\n📊 Status summary:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  - ${status}: ${count} tasks`);
    });
  } else {
    console.log('❌ No tasks found at all');
  }

  process.exit(0);
}

checkAllTasks().catch(console.error);