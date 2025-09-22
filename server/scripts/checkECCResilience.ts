import 'dotenv/config';
import { db } from '../db.js';
import { regulationControls } from '../../shared/schema.js';
import { eq, and } from 'drizzle-orm';

async function checkECCResilience() {
  console.log('🔍 Checking ECC Cybersecurity Resilience controls...');

  // Check for Cybersecurity Resilience controls in ECC (ID 29)
  const resilienceControls = await db
    .select()
    .from(regulationControls)
    .where(and(
      eq(regulationControls.regulationId, 29),
      eq(regulationControls.mainCategoryEn, 'Cybersecurity Resilience')
    ));

  console.log(`📊 ECC Cybersecurity Resilience controls: ${resilienceControls.length}`);

  if (resilienceControls.length > 0) {
    console.log('\n🔍 ECC Cybersecurity Resilience controls:');
    resilienceControls.forEach(control => {
      console.log(`  - Control ID ${control.id}: ${control.nameEn}`);
      console.log(`    Code: ${control.code}`);
      console.log(`    Category: ${control.mainCategoryEn}`);
    });
  } else {
    // Check what categories exist for ECC
    console.log('\n🔍 Available ECC categories:');
    const allECCControls = await db
      .select()
      .from(regulationControls)
      .where(eq(regulationControls.regulationId, 29));

    const categories = new Set();
    allECCControls.forEach(control => {
      categories.add(control.mainCategoryEn);
    });

    Array.from(categories).forEach(category => {
      console.log(`  - ${category}`);
    });
  }

  process.exit(0);
}

checkECCResilience().catch(console.error);