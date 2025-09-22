import 'dotenv/config';
import { db } from '../db.js';
import { tasks } from '../../shared/schema.js';

async function checkTaskFields() {
  const existingTasks = await db.select().from(tasks);
  console.log('Existing task field values:');
  existingTasks.forEach(t => {
    console.log(`Task ${t.id}: createdById='${t.createdById}', organizationId='${t.organizationId}', assigneeId='${t.assigneeId}'`);
  });

  process.exit(0);
}

checkTaskFields().catch(console.error);