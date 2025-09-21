/**
 * Import a new regulation from XLSX into regulations/regulation_controls
 * Supports flexible header mapping for different Excel formats
 *
 * Usage:
 *  tsx server/scripts/importRegulation.ts --code PDPL-2024 --name "PDPL" --version 2024 --file "path/to/file.xlsx" --dry-run
 *  tsx server/scripts/importRegulation.ts --code CSCC-2023 --name "Saudi Cloud Cybersecurity Controls" --version 2023 --file "path/to/file.xlsx" --commit
 */
import 'dotenv/config';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import XLSX from 'xlsx';
import { db } from '../db.js';
import { sql } from 'drizzle-orm';

const argv = yargs(hideBin(process.argv))
  .option('code', {
    type: 'string',
    demandOption: true,
    description: 'Regulation code (e.g., NCA-ECC-2024)'
  })
  .option('name', {
    type: 'string',
    demandOption: true,
    description: 'Regulation name in English'
  })
  .option('name-ar', {
    type: 'string',
    description: 'Regulation name in Arabic'
  })
  .option('version', {
    type: 'string',
    default: '1.0',
    description: 'Regulation version'
  })
  .option('publisher', {
    type: 'string',
    default: 'Unknown',
    description: 'Publisher organization'
  })
  .option('file', {
    type: 'string',
    demandOption: true,
    description: 'Path to XLSX file'
  })
  .option('sheet', {
    type: 'string',
    description: 'Sheet name (uses first sheet if not specified)'
  })
  .option('commit', {
    type: 'boolean',
    default: false,
    description: 'Commit changes to database'
  })
  .option('dry-run', {
    type: 'boolean',
    default: true,
    description: 'Show what would be done without making changes'
  })
  .option('org-id', {
    type: 'string',
    default: 'system',
    description: 'Organization ID for the regulation'
  })
  .option('created-by', {
    type: 'string',
    default: 'import-script',
    description: 'User ID who created the regulation'
  })
  .help()
  .parseSync();

// Flexible header mapping for different Excel formats
const HEADER_MAP = {
  clause: [
    'clause', 'clause number', 'clause_number', 'id', 'control code', 'code',
    'control id', 'control_id', 'ref', 'reference', 'item'
  ],
  mainCategoryEn: [
    'domain en', 'main category en', 'main_category_en', 'category en',
    'main domain en', 'domain', 'category', 'main category', 'section',
    'area', 'control family', 'family'
  ],
  mainCategoryAr: [
    'domain ar', 'main category ar', 'main_category_ar', 'category ar',
    'main domain ar', 'domain arabic', 'category arabic'
  ],
  subCategoryEn: [
    'subdomain en', 'subcategory en', 'sub_category_en', 'sub category en',
    'subdomain', 'subcategory', 'sub category', 'subsection', 'subarea'
  ],
  subCategoryAr: [
    'subdomain ar', 'subcategory ar', 'sub_category_ar', 'sub category ar',
    'subdomain arabic', 'subcategory arabic'
  ],
  mainControlEn: [
    'control en', 'title en', 'main_control_en', 'control title en',
    'control', 'title', 'control name', 'requirement', 'description',
    'control statement', 'objective'
  ],
  mainControlAr: [
    'control ar', 'title ar', 'main_control_ar', 'control title ar',
    'control arabic', 'title arabic', 'control name arabic'
  ],
  subControlEn: [
    'sub control en', 'subtitle en', 'sub_control_en', 'sub control',
    'sub requirement', 'detailed control'
  ],
  subControlAr: [
    'sub control ar', 'subtitle ar', 'sub_control_ar', 'sub control arabic'
  ],
  descriptionEn: [
    'description en', 'requirement en', 'guidance en', 'description_en',
    'details en', 'implementation guidance', 'guidance', 'details',
    'implementation', 'notes', 'explanation'
  ],
  descriptionAr: [
    'description ar', 'requirement ar', 'guidance ar', 'description_ar',
    'details ar', 'implementation guidance ar', 'guidance arabic'
  ],
  evidenceTypes: [
    'evidence types', 'evidence', 'evidence_types', 'required evidence',
    'evidence required', 'supporting evidence', 'proof', 'documentation',
    'evidence type', 'نوع الدليل المفترض تسليمه'
  ],
  weight: [
    'weight', 'priority', 'score', 'importance', 'criticality', 'rating',
    'control or subcontrol weight in scoring', 'وزن الضابط أو الضابط الفرعي في التقييم'
  ],
  // Additional XLSX fields
  rowNumber: ['#', 'row', 'no', 'number'],
  clauseNumberAr: ['رقم البند', 'clause number ar', 'رقم البند '],
  relatedControlsNumbering: ['ترقيم الضوابط التي تتطلب نفس الدليل', 'related controls numbering'],
  companySpecificDescription: ['وصف خاص بناء على متطلبات متغيرة بناء على طبيعة عمل الشركة', 'company specific description']
};

function normalizeKey(key: string): string {
  return key?.toLowerCase().trim().replace(/[_\s]+/g, ' ') || '';
}

function getValue(row: any, aliases: string[]): string | null {
  for (const alias of aliases) {
    // Try exact match first
    if (row[alias] !== undefined && row[alias] !== null && String(row[alias]).trim() !== '') {
      return String(row[alias]).trim();
    }

    // Try normalized match
    const normalized = normalizeKey(alias);
    for (const [key, value] of Object.entries(row)) {
      if (normalizeKey(key) === normalized && value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
  }
  return null;
}

function parseEvidenceTypes(evidenceStr: string | null): string[] {
  if (!evidenceStr) return [];

  // Split by common delimiters including $ and clean up
  const types = evidenceStr
    .split(/[,;|\/\n\$]/)
    .map(type => type.trim())
    .filter(type => type.length > 0);

  return types;
}

async function main() {
  const dry = !argv.commit;

  console.log(`📥 Regulation Import ${dry ? '[DRY-RUN]' : '[COMMIT]'}`);
  console.log(`📋 Code: ${argv.code}`);
  console.log(`📋 Name: ${argv.name}`);
  console.log(`📋 File: ${argv.file}`);
  console.log('='.repeat(60));

  try {
    // Read and parse Excel file
    console.log('📖 Reading Excel file...');
    const workbook = XLSX.readFile(argv.file);
    const sheetName = argv.sheet || workbook.SheetNames[0];

    if (!workbook.Sheets[sheetName]) {
      throw new Error(`Sheet "${sheetName}" not found. Available sheets: ${workbook.SheetNames.join(', ')}`);
    }

    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any>(worksheet, { defval: null });

    console.log(`📊 Found ${rows.length} rows in sheet "${sheetName}"`);

    if (rows.length === 0) {
      console.log('⚠️  No data rows found. Import completed.');
      return;
    }

    // Show available headers for debugging
    const sampleRow = rows[0];
    const headers = Object.keys(sampleRow);
    console.log(`📋 Available headers: ${headers.slice(0, 10).join(', ')}${headers.length > 10 ? '...' : ''}`);

    // Create or update regulation
    console.log('📋 Step 1: Creating/updating regulation...');

    const regulationResult = await db.execute(sql`
      INSERT INTO regulations (
        code,
        name_en,
        name_ar,
        version,
        publisher,
        status,
        org_id,
        created_by
      )
      VALUES (
        ${argv.code},
        ${argv.name},
        ${argv['name-ar'] || ''},
        ${argv.version},
        ${argv.publisher},
        'active',
        ${argv['org-id']},
        ${argv['created-by']}
      )
      ON CONFLICT (code) DO UPDATE SET
        name_en = EXCLUDED.name_en,
        name_ar = EXCLUDED.name_ar,
        version = EXCLUDED.version,
        publisher = EXCLUDED.publisher
      RETURNING id;
    `);

    const regulationId = (regulationResult as any).rows[0].id;
    console.log(`✅ Regulation ID: ${regulationId}`);

    // Begin transaction if committing
    if (!dry) {
      await db.execute(sql`BEGIN;`);
      console.log('🔒 Transaction started');
    }

    let prepared = 0;
    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    try {
      console.log('📋 Step 2: Processing controls...');

      for (const [index, rawRow] of rows.entries()) {
        if (index % 100 === 0 && index > 0) {
          console.log(`🔄 Progress: ${index}/${rows.length} (${Math.round((index/rows.length)*100)}%)`);
        }

        try {
          // Extract values using flexible mapping
          const clauseNumber = getValue(rawRow, HEADER_MAP.clause);
          const mainCategoryEn = getValue(rawRow, HEADER_MAP.mainCategoryEn);
          const mainCategoryAr = getValue(rawRow, HEADER_MAP.mainCategoryAr);
          const subCategoryEn = getValue(rawRow, HEADER_MAP.subCategoryEn);
          const subCategoryAr = getValue(rawRow, HEADER_MAP.subCategoryAr);
          const mainControlEn = getValue(rawRow, HEADER_MAP.mainControlEn);
          const mainControlAr = getValue(rawRow, HEADER_MAP.mainControlAr);
          const subControlEn = getValue(rawRow, HEADER_MAP.subControlEn);
          const subControlAr = getValue(rawRow, HEADER_MAP.subControlAr);
          const descriptionEn = getValue(rawRow, HEADER_MAP.descriptionEn);
          const descriptionAr = getValue(rawRow, HEADER_MAP.descriptionAr);
          const evidenceTypesRaw = getValue(rawRow, HEADER_MAP.evidenceTypes);
          const weightStr = getValue(rawRow, HEADER_MAP.weight);

          // Extract additional XLSX fields
          const rowNumberStr = getValue(rawRow, HEADER_MAP.rowNumber);
          const clauseNumberAr = getValue(rawRow, HEADER_MAP.clauseNumberAr);
          const relatedControlsNumbering = getValue(rawRow, HEADER_MAP.relatedControlsNumbering);
          const companySpecificDescription = getValue(rawRow, HEADER_MAP.companySpecificDescription);

          // Skip rows without essential data
          if (!clauseNumber && !mainControlEn) {
            skipped++;
            continue;
          }

          // Parse evidence types and weight
          const evidenceTypes = parseEvidenceTypes(evidenceTypesRaw);
          const weight = weightStr ? parseFloat(weightStr) : 1.0;
          const rowNumber = rowNumberStr ? parseInt(rowNumberStr) : null;

          prepared++;

          if (!dry) {
            // Check for existing control
            const existingResult = await db.execute(sql`
              SELECT id FROM regulation_controls
              WHERE regulation_id = ${regulationId}
                AND clause = ${clauseNumber || `IMPORT-${index + 1}`}
              LIMIT 1;
            `);

            if ((existingResult as any).rows.length > 0) {
              skipped++;
              continue;
            }

            // Insert new control
            const insertResult = await db.execute(sql`
              INSERT INTO regulation_controls (
                regulation_id,
                clause,
                main_category_en,
                main_category_ar,
                sub_category_en,
                sub_category_ar,
                main_control_en,
                main_control_ar,
                sub_control_en,
                sub_control_ar,
                description_en,
                description_ar,
                evidence_types,
                weight,
                row_number,
                clause_number_ar,
                related_controls_numbering,
                company_specific_description
              ) VALUES (
                ${regulationId},
                ${clauseNumber || `IMPORT-${index + 1}`},
                ${mainCategoryEn || ''},
                ${mainCategoryAr || ''},
                ${subCategoryEn || ''},
                ${subCategoryAr || ''},
                ${mainControlEn || ''},
                ${mainControlAr || ''},
                ${subControlEn || ''},
                ${subControlAr || ''},
                ${descriptionEn || ''},
                ${descriptionAr || ''},
                ${evidenceTypes.length > 0 ? sql.raw(`ARRAY[${evidenceTypes.map(e => `'${e.replace(/'/g, "''")}'`).join(',')}]`) : sql`ARRAY[]::TEXT[]`},
                ${isNaN(weight) ? 1.0 : weight},
                ${rowNumber},
                ${clauseNumberAr || ''},
                ${relatedControlsNumbering || ''},
                ${companySpecificDescription || ''}
              )
              RETURNING id;
            `);

            if ((insertResult as any).rows.length > 0) {
              inserted++;
            }
          } else {
            // Dry run - just count
            inserted++;
          }

        } catch (rowError: any) {
          console.warn(`⚠️  Error processing row ${index + 1}: ${rowError.message}`);
          errors++;
        }
      }

      console.log(`📊 Import summary:`);
      console.log(`   📝 Prepared: ${prepared}`);
      console.log(`   ✅ Inserted: ${inserted}`);
      console.log(`   ⏭️  Skipped: ${skipped}`);
      console.log(`   ❌ Errors: ${errors}`);

      if (!dry) {
        await db.execute(sql`COMMIT;`);
        console.log('✅ Import committed successfully!');

        // Final verification
        const finalCountResult = await db.execute(sql`
          SELECT COUNT(*) as count
          FROM regulation_controls
          WHERE regulation_id = ${regulationId};
        `);

        const totalControls = (finalCountResult as any).rows[0].count;
        console.log(`🎉 Total controls for ${argv.code}: ${totalControls}`);
      } else {
        console.log('📋 [DRY-RUN] No changes were made to the database');
        console.log(`📊 Would insert ${inserted} new controls into ${argv.code}`);
      }

    } catch (error) {
      if (!dry) {
        await db.execute(sql`ROLLBACK;`);
        console.log('🔴 Transaction rolled back due to error');
      }
      throw error;
    }

  } catch (error: any) {
    console.error('🔴 Import failed:', error?.message || error);
    if (error?.message?.includes('ENOENT')) {
      console.error(`📁 File not found: ${argv.file}`);
      console.error('   Please check the file path and try again.');
    }
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('✅ Regulation import completed successfully!');
}

main().catch(console.error);