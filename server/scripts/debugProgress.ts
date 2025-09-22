import 'dotenv/config';
import { db } from '../db.js';
import { tasks, regulationControls, projects } from '../../shared/schema.js';
import { eq, and } from 'drizzle-orm';

async function debugProgress() {
  console.log('🔍 Debugging progress calculation...');

  // Check projects
  const allProjects = await db.select().from(projects);
  console.log(`📊 Total projects: ${allProjects.length}`);

  if (allProjects.length > 0) {
    console.log('\n🔍 Projects:');
    allProjects.forEach(project => {
      console.log(`  - Project ${project.id}: ${project.name}`);
      console.log(`    Regulation ID: ${project.regulationId}`);
      console.log(`    Organization ID: ${project.organizationId}`);
    });
  }

  // Check all tasks
  const allTasks = await db.select().from(tasks);
  console.log(`\n📊 Total tasks: ${allTasks.length}`);

  if (allTasks.length > 0) {
    console.log('\n🔍 Tasks:');
    allTasks.forEach(task => {
      console.log(`  - Task ${task.id}: ${task.name} (${task.status})`);
      console.log(`    Project ID: ${task.projectId}`);
      console.log(`    Control ID: ${task.controlId}`);
    });
  }

  // Check tasks with controls joined (like the dashboard does)
  const tasksWithControls = await db
    .select()
    .from(tasks)
    .innerJoin(regulationControls, eq(tasks.controlId, regulationControls.id));

  console.log(`\n📊 Tasks with controls joined: ${tasksWithControls.length}`);

  if (tasksWithControls.length > 0) {
    console.log('\n🔍 Tasks with controls:');
    tasksWithControls.forEach(row => {
      const task = row.tasks;
      const control = row.regulation_controls;
      console.log(`  - Task ${task.id}: ${task.name} (${task.status})`);
      console.log(`    Control: ${control.nameEn}`);
      console.log(`    Domain: ${control.mainCategoryEn}`);
      console.log(`    Regulation ID: ${control.regulationId}`);
    });
  }

  // Check specifically for ECC regulation (ID 1)
  console.log('\n🔍 Checking ECC controls...');
  const eccControls = await db
    .select()
    .from(regulationControls)
    .where(eq(regulationControls.regulationId, 1));

  console.log(`📊 ECC controls: ${eccControls.length}`);

  // Check for Cybersecurity Resilience controls specifically
  const resilienceControls = await db
    .select()
    .from(regulationControls)
    .where(and(
      eq(regulationControls.regulationId, 1),
      eq(regulationControls.mainCategoryEn, 'Cybersecurity Resilience')
    ));

  console.log(`📊 ECC Cybersecurity Resilience controls: ${resilienceControls.length}`);

  if (resilienceControls.length > 0) {
    console.log('\n🔍 ECC Cybersecurity Resilience controls:');
    resilienceControls.forEach(control => {
      console.log(`  - Control ${control.id}: ${control.nameEn}`);
    });
  }

  process.exit(0);
}

debugProgress().catch(console.error);