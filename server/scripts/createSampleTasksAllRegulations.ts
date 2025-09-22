import 'dotenv/config';
import { db } from '../db.js';
import { tasks, projects, regulationControls } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

async function createSampleTasksAllRegulations() {
  console.log('🔧 Creating sample projects and tasks for all regulations...');

  const regulationsToFix = [
    { id: 30, code: 'CSCC-2023', name: 'Saudi Cloud Cybersecurity Controls' },
    { id: 31, code: 'CRFR-2023', name: 'Critical Risk Framework Requirements' },
    { id: 33, code: 'MVC-2024', name: 'Ministry Vendor Controls Guidelines' }
  ];

  for (const regulation of regulationsToFix) {
    console.log(`\n📋 Processing ${regulation.code}...`);

    // Create a sample project for this regulation
    const [newProject] = await db
      .insert(projects)
      .values({
        name: `Sample ${regulation.code} Project`,
        description: `Sample project for ${regulation.name}`,
        regulationId: regulation.id,
        organizationId: 'default',
        ownerId: '43347675', // Use same owner ID as existing projects
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    console.log(`✅ Created project ${newProject.id}: ${newProject.name}`);

    // Get controls for this regulation (first few from each domain)
    const controls = await db
      .select()
      .from(regulationControls)
      .where(eq(regulationControls.regulationId, regulation.id))
      .limit(6); // Get up to 6 controls

    if (controls.length === 0) {
      console.log(`❌ No controls found for ${regulation.code}`);
      continue;
    }

    // Group controls by domain and take 1-2 from each domain
    const domainControls = new Map();
    controls.forEach(control => {
      const domain = control.mainCategoryEn || 'Other';
      if (!domainControls.has(domain)) {
        domainControls.set(domain, []);
      }
      if (domainControls.get(domain).length < 2) { // Max 2 per domain
        domainControls.get(domain).push(control);
      }
    });

    // Create completed tasks for these controls
    let taskCount = 0;
    for (const [domain, domainControlsList] of domainControls) {
      for (const control of domainControlsList) {
        taskCount++;
        const [newTask] = await db
          .insert(tasks)
          .values({
            title: `${regulation.code} ${domain} Task ${taskCount}`,
            description: `Sample completed task for ${control.nameEn || 'control'}`,
            status: 'completed',
            projectId: newProject.id,
            controlId: control.id,
            organizationId: 'default',
            createdById: '43347675', // Use same user ID as existing tasks
            assigneeId: '43347675',  // Use same user ID as existing tasks
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();

        console.log(`  ✅ Created completed task ${newTask.id}: ${newTask.title} (controlId: ${control.id}, domain: ${domain})`);
      }
    }

    console.log(`📊 Created ${taskCount} completed tasks for ${regulation.code}`);
  }

  console.log('\n🎉 Sample projects and tasks created for all regulations!');
  console.log('The dashboard should now show progress for all regulations.');
  process.exit(0);
}

createSampleTasksAllRegulations().catch(console.error);