import 'dotenv/config';
import { db } from '../db.js';
import { projects } from '../../shared/schema.js';

async function checkOwnerIds() {
  const existingProjects = await db.select().from(projects);
  console.log('Existing project owner IDs:');
  existingProjects.forEach(p => console.log(`Project ${p.id}: ownerId = '${p.ownerId}'`));

  if (existingProjects.length === 0) {
    console.log('No existing projects found');
  }

  process.exit(0);
}

checkOwnerIds().catch(console.error);