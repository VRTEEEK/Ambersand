import 'dotenv/config';
import { db } from '../db.js';
import { regulationControls } from '../../shared/schema.js';
import { eq, and } from 'drizzle-orm';

async function checkDCCControls() {
  console.log('🔍 Checking DCC controls...');

  // Check all DCC controls (regulation ID 32)
  const dccControls = await db
    .select()
    .from(regulationControls)
    .where(eq(regulationControls.regulationId, 32));

  console.log(`📊 Total DCC controls: ${dccControls.length}`);

  if (dccControls.length > 0) {
    // Group by domain
    const domains = new Map();
    dccControls.forEach(control => {
      const domain = control.mainCategoryEn || 'Other';
      if (!domains.has(domain)) {
        domains.set(domain, []);
      }
      domains.get(domain).push(control);
    });

    console.log('\n🔍 DCC domains and controls:');
    domains.forEach((controls, domain) => {
      console.log(`\n  📂 ${domain} (${controls.length} controls):`);
      controls.slice(0, 3).forEach(control => {
        console.log(`    - Control ID ${control.id}: ${control.nameEn || 'undefined'}`);
      });
      if (controls.length > 3) {
        console.log(`    ... and ${controls.length - 3} more`);
      }
    });
  }

  process.exit(0);
}

checkDCCControls().catch(console.error);