import 'dotenv/config';
import { db } from '../db.js';
import { regulations, regulationControls } from '../../shared/schema.js';
import { eq, count } from 'drizzle-orm';

async function checkRegulations() {
  console.log('🔍 Checking regulations and their controls...');

  const allRegulations = await db.select().from(regulations);
  console.log(`📊 Total regulations: ${allRegulations.length}`);

  if (allRegulations.length > 0) {
    console.log('\n🔍 Available regulations:');
    for (const reg of allRegulations) {
      // Count controls for this regulation
      const [{ count: controlCount }] = await db
        .select({ count: count() })
        .from(regulationControls)
        .where(eq(regulationControls.regulationId, reg.id));

      console.log(`  - ID ${reg.id}: ${reg.code} - ${reg.nameEn} (${controlCount} controls)`);
      console.log(`    Publisher: ${reg.publisher || 'Unknown'}`);
      console.log(`    Org ID: ${reg.orgId}`);
    }
  }

  // Check which regulation ID should be ECC
  console.log('\n🔍 Looking for ECC regulation...');
  const eccRegulation = await db
    .select()
    .from(regulations)
    .where(eq(regulations.code, 'NCA-ECC-2024'));

  if (eccRegulation.length > 0) {
    console.log(`✅ Found ECC regulation with ID: ${eccRegulation[0].id}`);
  } else {
    console.log('❌ ECC regulation not found');
  }

  process.exit(0);
}

checkRegulations().catch(console.error);