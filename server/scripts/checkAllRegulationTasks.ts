import 'dotenv/config';
import { db } from '../db.js';
import { tasks, projects, regulations } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

async function checkAllRegulationTasks() {
  console.log('🔍 Checking all tasks across all regulations...');

  // Get all projects with their regulation info
  const projectsWithRegulations = await db
    .select()
    .from(projects)
    .innerJoin(regulations, eq(projects.regulationId, regulations.id));

  console.log(`📊 Total projects: ${projectsWithRegulations.length}`);

  if (projectsWithRegulations.length > 0) {
    console.log('\n🔍 Projects by regulation:');
    for (const row of projectsWithRegulations) {
      const project = row.projects;
      const regulation = row.regulations;

      console.log(`\n  📂 Project ${project.id}: ${project.name}`);
      console.log(`     Regulation: ${regulation.code} - ${regulation.nameEn}`);

      // Get tasks for this project
      const projectTasks = await db
        .select()
        .from(tasks)
        .where(eq(tasks.projectId, project.id));

      console.log(`     Tasks: ${projectTasks.length}`);

      if (projectTasks.length > 0) {
        projectTasks.forEach(task => {
          const hasControl = task.controlId ? '✅' : '❌';
          console.log(`       - Task ${task.id}: ${task.name || 'unnamed'} (${task.status}) ${hasControl} controlId: ${task.controlId}`);
        });
      }
    }
  }

  // Summary of issues
  console.log('\n📊 Summary:');
  const allTasks = await db.select().from(tasks);
  const tasksWithoutControls = allTasks.filter(task => task.controlId === null);
  const completedTasksWithoutControls = allTasks.filter(task => task.status === 'completed' && task.controlId === null);

  console.log(`  - Total tasks: ${allTasks.length}`);
  console.log(`  - Tasks without control IDs: ${tasksWithoutControls.length}`);
  console.log(`  - Completed tasks without control IDs: ${completedTasksWithoutControls.length} (⚠️  Won't count in dashboard)`);

  process.exit(0);
}

checkAllRegulationTasks().catch(console.error);