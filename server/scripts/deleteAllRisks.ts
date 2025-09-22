import 'dotenv/config';
import { db } from '../db.js';
import { risks } from '../../shared/schema.js';

async function deleteAllRisks() {
  console.log('🔍 Checking current risks...');

  // First, count current risks
  const currentRisks = await db.select().from(risks);
  console.log(`📊 Found ${currentRisks.length} risks in the Risk Register`);

  if (currentRisks.length === 0) {
    console.log('✅ No risks to delete - Risk Register is already empty');
    process.exit(0);
  }

  // Show the risks that will be deleted
  console.log('\n🔍 Risks to be deleted:');
  currentRisks.forEach((risk, index) => {
    console.log(`  ${index + 1}. ${risk.title || 'Untitled'} (ID: ${risk.id})`);
    console.log(`     Category: ${risk.category || 'N/A'}`);
    console.log(`     Severity: ${risk.severity || 'N/A'}`);
  });

  console.log('\n🗑️  Deleting all risks...');

  // Delete all risks
  const deletedRisks = await db.delete(risks).returning();

  console.log(`✅ Successfully deleted ${deletedRisks.length} risks from the Risk Register`);
  console.log('🎉 Risk Register is now empty');

  process.exit(0);
}

deleteAllRisks().catch(console.error);