import 'dotenv/config';
import { db } from '../db.js';
import { regulations, regulationControls } from '../../shared/schema.js';
import { count, eq } from 'drizzle-orm';

async function checkRegulations() {
  console.log('🔍 Checking regulations in database...');
  console.log('='.repeat(50));

  // Check regulations
  const allRegulations = await db.select().from(regulations);
  console.log(`📊 Total regulations in database: ${allRegulations.length}`);

  if (allRegulations.length > 0) {
    console.log('\n🔍 Available regulations:');
    for (const reg of allRegulations) {
      // Count controls for this regulation
      const [{ count: controlCount }] = await db
        .select({ count: count() })
        .from(regulationControls)
        .where(eq(regulationControls.regulationId, reg.id));

      console.log(`  - ${reg.code}: ${reg.nameEn} (v${reg.version}) - ${controlCount} controls`);
      console.log(`    Publisher: ${reg.publisher || 'Unknown'}`);
      console.log(`    Org ID: ${reg.orgId}`);
    }
  } else {
    console.log('❌ No regulations found in database');
    console.log('💡 You may need to run the import scripts to add regulations.');
  }

  console.log('='.repeat(50));
  process.exit(0);
}

checkRegulations().catch(console.error);