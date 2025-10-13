import { db } from "../db";
import { users } from "@shared/schema";
import { authUsers } from "@shared/authSchema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";

/**
 * Migration script to merge auth_users data into users table
 * 
 * Strategy:
 * 1. For users in auth_users that match by email in users: update password_hash
 * 2. For users only in auth_users: insert as new users with new IDs
 * 3. For users only in users: keep them but they'll need to set password later
 */

async function migrateAuthUsers() {
  console.log("🔄 Starting auth_users → users migration...");

  try {
    // Get all users from auth_users (select only fields that exist in DB)
    const authUsersList = await db.select({
      id: authUsers.id,
      email: authUsers.email,
      passwordHash: authUsers.passwordHash,
      emailVerified: authUsers.emailVerified,
      emailVerifiedAt: authUsers.emailVerifiedAt,
      firstName: authUsers.firstName,
      lastName: authUsers.lastName,
      organizationId: authUsers.organizationId,
      role: authUsers.role,
      language: authUsers.language,
      isActive: authUsers.isActive,
      createdAt: authUsers.createdAt,
      updatedAt: authUsers.updatedAt,
      lastLoginAt: authUsers.lastLoginAt,
    }).from(authUsers);
    console.log(`📊 Found ${authUsersList.length} users in auth_users`);

    // Get all users from users table
    const existingUsers = await db.select().from(users);
    console.log(`📊 Found ${existingUsers.length} users in users table`);

    let updated = 0;
    let inserted = 0;

    for (const authUser of authUsersList) {
      // Check if user exists in users table by email
      const existingUser = existingUsers.find(
        (u) => u.email?.toLowerCase() === authUser.email.toLowerCase()
      );

      if (existingUser) {
        // Update existing user with password_hash from auth_users
        await db
          .update(users)
          .set({
            passwordHash: authUser.passwordHash,
            emailVerified: authUser.emailVerified,
            emailVerifiedAt: authUser.emailVerifiedAt,
            lastLoginAt: authUser.lastLoginAt,
            isActive: authUser.isActive,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingUser.id));

        console.log(`✅ Updated user: ${authUser.email} (id: ${existingUser.id})`);
        updated++;
      } else {
        // Insert new user with new ID
        const newUserId = nanoid();
        const fullName = [authUser.firstName, authUser.lastName].filter(Boolean).join(' ') || undefined;
        
        await db.insert(users).values({
          id: newUserId,
          email: authUser.email,
          firstName: authUser.firstName || undefined,
          lastName: authUser.lastName || undefined,
          name: fullName, // Combine first and last name
          organizationId: authUser.organizationId || undefined,
          role: authUser.role,
          language: authUser.language || "en",
          passwordHash: authUser.passwordHash,
          emailVerified: authUser.emailVerified,
          emailVerifiedAt: authUser.emailVerifiedAt,
          lastLoginAt: authUser.lastLoginAt,
          isActive: authUser.isActive,
          createdAt: authUser.createdAt,
          updatedAt: new Date(),
        });

        console.log(`➕ Inserted new user: ${authUser.email} (new id: ${newUserId})`);
        inserted++;
      }
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   - Updated: ${updated} users`);
    console.log(`   - Inserted: ${inserted} users`);
    console.log(`   - Total in users table: ${existingUsers.length + inserted}`);

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

export { migrateAuthUsers };

// Run migration if called directly
migrateAuthUsers()
  .then(() => {
    console.log("🎉 Migration completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  });
