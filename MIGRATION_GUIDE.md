# ECC → Generic Regulations Migration Guide

## ✅ Migration Status

The ECC mid-term migration has been **successfully completed**:

- ✅ **200 ECC controls** migrated to generic `regulation_controls` table
- ✅ **176 task controls** updated with regulation mappings
- ✅ **3 evidence controls** updated with regulation mappings
- ✅ **Mapping table** created for ECC → regulation_controls ID mapping
- ✅ **Read-only trigger** applied to `ecc_controls` table
- ✅ **Legacy join tables** updated with new regulation control IDs

## 🔧 Available Commands

The following migration scripts have been added to your project:

### 1. ECC Migration
```bash
# Test what would be migrated (safe to run multiple times)
npm run migrate:ecc -- --dry-run

# Execute the actual migration
npm run migrate:ecc -- --commit
```

### 2. Import New Regulations from XLSX
```bash
# Test XLSX import
npm run import:regulation -- --code "CSCC-2023" --name "Saudi Cloud Cybersecurity Controls" --version "2023" --file "path/to/CSCC.xlsx" --dry-run

# Execute XLSX import
npm run import:regulation -- --code "CSCC-2023" --name "Saudi Cloud Cybersecurity Controls" --version "2023" --file "path/to/CSCC.xlsx" --commit
```

### 3. Rollback Migration (if needed)
```bash
# Test rollback (shows what would be removed)
npm run rollback:ecc -- --dry-run

# Execute rollback (removes migrated data, keeps regulation record)
npm run rollback:ecc -- --commit --force

# Execute rollback and remove regulation record (dangerous!)
npm run rollback:ecc -- --commit --force --drop-regulation
```

## 📥 Import Additional Regulations

When you have the XLSX files ready, use these commands to import them:

### CSCC (Cloud Security Controls)
```bash
npm run import:regulation -- \
  --code "CSCC-2023" \
  --name "Saudi Cloud Cybersecurity Controls" \
  --name-ar "ضوابط الأمن السيبراني السحابي السعودي" \
  --version "2023" \
  --publisher "CITC" \
  --file "path/to/CSCC.xlsx" \
  --commit
```

### CRFR (Critical Risk Framework)
```bash
npm run import:regulation -- \
  --code "CRFR-2023" \
  --name "Critical Risk Framework Requirements" \
  --version "2023" \
  --publisher "SAMA" \
  --file "path/to/CRFR.xlsx" \
  --commit
```

### DCC (Data Classification Controls)
```bash
npm run import:regulation -- \
  --code "DCC-2022" \
  --name "Data Classification Controls" \
  --version "2022" \
  --publisher "NDMO" \
  --file "path/to/DCC.xlsx" \
  --commit
```

### MVC (Ministry Vendor Controls)
```bash
npm run import:regulation -- \
  --code "MVC-2024" \
  --name "Ministry Vendor Controls Guidelines" \
  --version "2024" \
  --publisher "Ministry" \
  --file "path/to/MVC.xlsx" \
  --commit
```

## 📊 Database Changes

### New Tables Created
- `ecc_to_regulation_controls_map` - Maps old ECC IDs to new regulation control IDs
- Enhanced `regulation_controls` with additional columns for flexible regulation support

### Modified Tables
- `projects` - Added `regulation_id` column linking to `regulations.id`
- `task_controls` - Added `regulation_control_id` column for new references
- `evidence_controls` - Added `regulation_control_id` column for new references
- `ecc_controls` - Made read-only via trigger (migration safety)

### Data Migration Results
- **ECC Regulation Created**: `NCA-ECC-2024` (ID: 4)
- **Controls Migrated**: 200 controls from `ecc_controls` → `regulation_controls`
- **Mappings Created**: 200 entries in `ecc_to_regulation_controls_map`
- **Legacy References Updated**: 179 total references updated across join tables

## 🔍 Verification Queries

Check migration success with these SQL queries:

```sql
-- Count controls per regulation
SELECT r.code, r.name_en, COUNT(rc.id) as control_count
FROM regulations r
LEFT JOIN regulation_controls rc ON r.id = rc.regulation_id
GROUP BY r.id, r.code, r.name_en
ORDER BY r.code;

-- Verify ECC mapping completeness
SELECT COUNT(*) as mapped_controls FROM ecc_to_regulation_controls_map;
SELECT COUNT(*) as original_ecc_controls FROM ecc_controls;

-- Check projects with regulation associations
SELECT COUNT(*) as projects_with_regulation FROM projects WHERE regulation_id IS NOT NULL;

-- Verify legacy join table updates
SELECT COUNT(*) as task_controls_with_regulation_id FROM task_controls WHERE regulation_control_id IS NOT NULL;
SELECT COUNT(*) as evidence_controls_with_regulation_id FROM evidence_controls WHERE regulation_control_id IS NOT NULL;
```

## 🚨 Important Notes

1. **ECC Controls Read-Only**: The `ecc_controls` table is now read-only. All new operations should use the `regulation_controls` table.

2. **Backwards Compatibility**: Legacy `task_controls.ecc_control_id` and `evidence_controls.ecc_control_id` still exist and have corresponding `regulation_control_id` values populated.

3. **UI Updates Required**: Your frontend should be updated to use the generic regulation APIs instead of ECC-specific endpoints.

4. **Safe Rollback**: The rollback script is available if needed, but should be used with caution in production environments.

5. **XLSX Import Flexibility**: The import script handles various Excel header formats automatically (e.g., "Control", "Control EN", "Requirement", etc.).

## 📁 File Structure

Migration files added:
```
server/scripts/
├── migrateECC.ts          # ECC → regulations migration
├── importRegulation.ts    # XLSX → regulations import
└── rollbackECC.ts        # Migration rollback

drizzle/
├── 2025_09_21_ecc_midterm_migration.sql          # Original migration
└── 2025_09_21_ecc_midterm_migration_fixed.sql    # Applied migration
```

## 🎉 Next Steps

1. **Upload XLSX Files**: Place your regulation XLSX files in the project directory
2. **Import Regulations**: Use the import commands above to add new regulations
3. **Update Frontend**: Modify UI to use generic regulation endpoints
4. **Test Thoroughly**: Verify all functionality works with the new data structure
5. **Remove ECC Dependencies**: Gradually phase out ECC-specific code

The migration is complete and your system is now ready for multi-regulation support! 🚀