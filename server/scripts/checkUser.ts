import { db } from '../db.js';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function checkUser() {
  try {
    const result = await db.select().from(users).where(eq(users.id, '3'));
    console.log('User data from database:');
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUser();
