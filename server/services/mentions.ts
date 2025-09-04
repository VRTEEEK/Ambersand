import { db } from "../db";
import { users } from "@shared/schema";
import { and, eq, ilike, or } from "drizzle-orm";

export interface ParsedMentions {
  userIds: number[];
  users: Array<{ id: number; name: string; email: string }>;
}

// Parse @mentions in the body -> return { userIds: number[], users: Array<{id:number, name:string, email:string}> }
export async function parseMentions(body: string, orgId: string): Promise<ParsedMentions> {
  // Regex for @mentions (alphanumeric, dots, underscores, hyphens)
  const handles = Array.from(new Set((body.match(/@[\w.\-]+/g) || []).map(s => s.slice(1))));
  
  if (handles.length === 0) {
    return { userIds: [], users: [] };
  }

  // Lookup users by name/email within organization
  const foundUsers = await findUsersByHandles(handles, orgId);
  
  return { 
    userIds: foundUsers.map(u => u.id), 
    users: foundUsers 
  };
}

// Find users by handles (name patterns) within organization
async function findUsersByHandles(handles: string[], orgId: string): Promise<Array<{ id: number; name: string; email: string }>> {
  if (handles.length === 0) return [];

  // Build OR conditions for each handle to match against name or email
  const searchConditions = handles.map(handle => 
    or(
      ilike(users.name, `%${handle}%`),
      ilike(users.email, `%${handle}%`),
      ilike(users.firstName, `%${handle}%`),
      ilike(users.lastName, `%${handle}%`)
    )
  );

  const foundUsers = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
  })
    .from(users)
    .where(and(
      eq(users.organizationId, orgId),
      or(...searchConditions)
    ));

  // Convert string ID to number for compatibility
  return foundUsers.map(user => ({
    ...user,
    id: parseInt(user.id),
    name: user.name || user.email || 'Unknown User',
    email: user.email || '',
  }));
}

// API endpoint to search users for mentions autocomplete
export async function searchUsersForMentions(query: string, orgId: string, limit: number = 10): Promise<Array<{ id: number; name: string; email: string; handle: string }>> {
  if (!query || query.length < 2) return [];

  const foundUsers = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    firstName: users.firstName,
    lastName: users.lastName,
  })
    .from(users)
    .where(and(
      eq(users.organizationId, orgId),
      or(
        ilike(users.name, `%${query}%`),
        ilike(users.email, `%${query}%`),
        ilike(users.firstName, `%${query}%`),
        ilike(users.lastName, `%${query}%`)
      )
    ))
    .limit(limit);

  return foundUsers.map(user => {
    const displayName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User';
    const handle = user.email?.split('@')[0] || user.name?.toLowerCase().replace(/\s+/g, '.') || 'unknown';
    
    return {
      id: parseInt(user.id),
      name: displayName,
      email: user.email || '',
      handle: handle,
    };
  });
}