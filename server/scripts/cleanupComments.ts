import 'dotenv/config';
import { db } from '../db.js';
import { sql } from 'drizzle-orm';

async function cleanupComments() {
  console.log('🧹 Cleaning up remaining comments and subscriptions...');

  // Delete comment subscriptions first (foreign key dependency)
  const subsResult = await db.execute(sql`DELETE FROM comment_subscriptions;`);
  console.log(`✅ Deleted ${(subsResult as any).rowsAffected || 0} comment subscriptions`);

  // Delete comments
  const commentsResult = await db.execute(sql`DELETE FROM comments;`);
  console.log(`✅ Deleted ${(commentsResult as any).rowsAffected || 0} comments`);

  console.log('🎉 All comments and subscriptions deleted!');
  process.exit(0);
}

cleanupComments().catch(console.error);