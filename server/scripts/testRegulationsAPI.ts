import 'dotenv/config';
import { storage } from '../storage.js';

async function testRegulationsAPI() {
  console.log('🔍 Testing getDynamicRegulations function...');
  console.log('='.repeat(50));

  try {
    // Test without organizationId
    console.log('📊 Testing with no organizationId...');
    const regulationsNoOrg = await storage.getDynamicRegulations();
    console.log(`Result: ${regulationsNoOrg.length} regulations`);
    regulationsNoOrg.forEach(reg => {
      console.log(`  - ${reg.code}: ${reg.nameEn}`);
      console.log(`    Domains: ${reg.domains.length}`);
      reg.domains.forEach(domain => {
        console.log(`      • ${domain.nameEn}: ${domain.completed}/${domain.total} (${domain.percentage}%)`);
      });
    });

    console.log('\n📊 Testing with system organizationId...');
    const regulationsSystem = await storage.getDynamicRegulations('system');
    console.log(`Result: ${regulationsSystem.length} regulations`);

    console.log('\n📊 Testing with user organizationId...');
    const regulationsUser = await storage.getDynamicRegulations('user-org-123');
    console.log(`Result: ${regulationsUser.length} regulations`);

  } catch (error) {
    console.error('❌ Error testing regulations API:', error);
  }

  console.log('='.repeat(50));
  process.exit(0);
}

testRegulationsAPI().catch(console.error);