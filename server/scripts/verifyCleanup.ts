import 'dotenv/config';
import { db } from '../db.js';
import { sql } from 'drizzle-orm';

async function verifyCleanup() {
  const tables = [
    'projects', 'tasks', 'evidence',
    'project_regulation_controls', 'task_controls', 'evidence_controls',
    'comments', 'comment_subscriptions'
  ];

  console.log('🔍 Verifying system cleanup...');
  console.log('='.repeat(40));

  let totalRecords = 0;

  for (const table of tables) {
    try {
      const result = await db.execute(sql`SELECT COUNT(*) as count FROM ${sql.raw(table)};`);
      const count = parseInt(result.rows[0].count as string);
      totalRecords += count;

      const status = count === 0 ? '✅' : '⚠️';
      console.log(`${status} ${table}: ${count} records`);
    } catch (error) {
      console.log(`❌ ${table}: Error - ${error}`);
    }
  }

  console.log('='.repeat(40));
  console.log(`📊 Total records remaining: ${totalRecords}`);

  if (totalRecords === 0) {
    console.log('🎉 System is completely clean - ready for testing!');
  } else {
    console.log('⚠️ System cleanup incomplete - some records remain');
  }

  process.exit(0);
}

verifyCleanup().catch(console.error);