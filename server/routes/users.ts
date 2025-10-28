import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { users, userInvites, tasks } from "@shared/schema";
import { requireAuth } from "../middleware/authMiddleware";
import { and, eq, ilike, or } from "drizzle-orm";
import email from "../email";
import crypto from "crypto";

const router = Router();


// Debug endpoint to see what the server thinks about auth
router.get("/me", requireAuth, (req: any, res) => {
  res.json({
    userId: req.userId,
    organizationId: req.organizationId,
    userEmail: req.userEmail,
    userRole: req.userRole,
  });
});

// Debug endpoint for search issues
router.get("/search/debug", requireAuth, async (req: any, res) => {
  const q = String(req.query.q || "").trim();
  res.json({
    gotCookie: !!req.headers.cookie,
    organizationId: req.organizationId || null,
    userId: req.userId,
    userEmail: req.userEmail,
    q,
  });
});

router.get("/search", requireAuth, async (req: any, res) => {
  const q = String(req.query.q || "").trim();
  const limit = Math.min(Number(req.query.limit || 8), 25);
  const orgId = req.organizationId || 'default';

  if (!q || q.length < 2) return res.json({ items: [] });

  try {
    // Search users by email, firstName, lastName within organization only
    const rows = await db.query.users.findMany({
      where: (u, { and, or, ilike, eq }) => {
        const searchConditions = or(
          ilike(u.email, `%${q}%`),
          ilike(u.firstName, `%${q}%`),
          ilike(u.lastName, `%${q}%`)
        );
        
        return and(
          searchConditions,
          eq(u.organizationId, orgId) // Same organization only
        );
      },
      limit,
      columns: { id: true, email: true, name: true, firstName: true, lastName: true, profileImageUrl: true }
    });

    const items = rows.map(u => ({
      id: u.id,
      email: u.email || "",
      name: u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || "User",
      avatarUrl: u.profileImageUrl || null,
    }));
    
    res.json({ items });
  } catch (error) {
    console.error("User search error:", error);
    res.status(500).json({ items: [], message: "Search failed" });
  }
});

// POST /api/users/invite { email, role? }
router.post("/invite", requireAuth, async (req: any, res) => {
  console.log('🔥 /api/users/invite called');
  console.log('🔥 req.user:', JSON.stringify(req.user, null, 2));
  console.log('🔥 req.body:', JSON.stringify(req.body, null, 2));

  const inviteEmail = String(req.body?.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
    return res.status(400).json({ message: "Invalid email" });
  }

  // Get current user from database to get organizationId
  const currentUserId = req.userId;
  console.log('🔥 currentUserId:', currentUserId);

  const currentUserResult = await db.select({
    id: users.id,
    email: users.email,
    firstName: users.firstName,
    organizationId: users.organizationId
  })
  .from(users)
  .where(eq(users.id, currentUserId))
  .limit(1);

  console.log('🔥 currentUserResult:', JSON.stringify(currentUserResult, null, 2));

  if (currentUserResult.length === 0) {
    console.log('❌ User not found in database');
    return res.status(401).json({ message: "User not found in database" });
  }

  const orgId = currentUserResult[0].organizationId || 'default';
  console.log('🔥 orgId:', orgId);

  const existing = await db.query.users.findFirst({
    where: (u, { and, eq }) => and(eq(u.organizationId, orgId), eq(u.email, inviteEmail)),
    columns: { id: true }
  });
  if (existing) return res.status(409).json({ message: "Already a user", userId: existing.id });

  const token = crypto.randomUUID().replace(/-/g, "");
  const [invite] = await db.insert(userInvites).values({
    organizationId: orgId,
    email: inviteEmail,
    role: "member",
    token,
  }).returning();

  // Mailer preflight
  if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) {
    return res.status(500).json({ message: "Email not configured (SENDGRID_API_KEY / SENDGRID_FROM_EMAIL)" });
  }

  const acceptUrl = `${process.env.APP_BASE_URL || "http://localhost:3000"}/accept-invite?token=${token}`;

  try {
    const result = await email.send({
      to: inviteEmail,
      subject: "You're invited to Ambersand",
      templateName: "user-invitation.en",
      data: {
        acceptUrl,
        organizationName: "Ambersand",
        inviterName: currentUserResult[0].firstName || req.userEmail?.split('@')[0] || 'Someone'
      }
    });
    if (!result?.success) {
      return res.status(502).json({ message: `Failed to send invite email: ${result?.error || "unknown"}` });
    }
  } catch (e: any) {
    console.error("Invite email error:", e?.response?.body || e?.message || e);
    return res.status(502).json({ message: "Failed to send invite email" });
  }

  res.status(201).json({ inviteId: invite.id });
});

// POST /api/users/invite/accept { token, email }
// Accept invite and auto-assign pending tasks per specification
// This endpoint works for both authenticated and unauthenticated users
router.post("/invite/accept", async (req: any, res) => {
  try {
    const { token, email: providedEmail } = z.object({
      token: z.string().min(10),
      email: z.string().email().optional()
    }).parse(req.body);

    const [invite] = await db.select().from(userInvites)
      .where(and(eq(userInvites.token, token), eq(userInvites.accepted, false)));

    if (!invite) {
      return res.status(400).json({ message: "Invalid or expired invite" });
    }

    // If user is authenticated, verify organization match
    if (req.user) {
      const currentUserId = req.userId;
      const currentUserResult = await db.select({
        id: users.id,
        email: users.email,
        organizationId: users.organizationId
      })
      .from(users)
      .where(eq(users.id, currentUserId))
      .limit(1);

      if (currentUserResult.length > 0) {
        const currentUser = currentUserResult[0];

        // Check if email matches the invite
        if (currentUser.email?.toLowerCase() !== invite.email.toLowerCase()) {
          return res.status(403).json({
            message: "This invite is for a different email address",
            inviteEmail: invite.email,
            yourEmail: currentUser.email
          });
        }

        // Update user's organization if needed
        if (currentUser.organizationId !== invite.organizationId) {
          await db.update(users)
            .set({ organizationId: invite.organizationId })
            .where(eq(users.id, currentUser.id));
        }

        // Mark invite as accepted
        await db.update(userInvites).set({
          accepted: true,
          acceptedAt: new Date()
        }).where(eq(userInvites.id, invite.id));

        // Move all tasks with pendingAssigneeInviteId → assigneeId = current user
        const updated = await db.update(tasks)
          .set({
            assigneeId: currentUser.id,
            pendingAssigneeInviteId: null,
            updatedAt: new Date()
          })
          .where(eq(tasks.pendingAssigneeInviteId, invite.id))
          .returning({ id: tasks.id, title: tasks.title });

        return res.json({ success: true, assignedTasks: updated });
      }
    }

    // If not authenticated, just return success - they need to sign up first
    return res.json({
      success: true,
      requiresSignup: true,
      message: "Please sign up or log in to accept this invitation",
      inviteEmail: invite.email
    });

  } catch (error) {
    console.error("Error accepting invite:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid request data" });
    }
    res.status(500).json({ message: "Failed to accept invite" });
  }
});

// GET /api/users/invite/:token (get invite details)
router.get("/invite/:token", async (req: any, res) => {
  try {
    const { token } = req.params;

    const invite = await db.select()
      .from(userInvites)
      .where(and(
        eq(userInvites.token, token),
        eq(userInvites.accepted, false)
      ))
      .limit(1);

    if (invite.length === 0) {
      return res.status(404).json({ message: "Invalid or expired invite" });
    }

    // Return invite details for the frontend to handle
    res.json({
      email: invite[0].email,
      role: invite[0].role,
      organizationId: invite[0].organizationId,
      token: invite[0].token,
    });
  } catch (error) {
    console.error("Error fetching invite:", error);
    res.status(500).json({ message: "Failed to fetch invite" });
  }
});

// PUT /api/users/:userId - Update user profile
router.put("/:userId", requireAuth, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId;

    // Users can only update their own profile
    if (userId !== currentUserId) {
      return res.status(403).json({ message: "You can only update your own profile" });
    }

    const updateData = z.object({
      firstName: z.string().min(1, "First name is required"),
      lastName: z.string().min(1, "Last name is required"),
      email: z.string().email("Invalid email address"),
      phone: z.string().regex(/^[0-9+\-\s()]*$/, "Phone number can only contain numbers, +, -, spaces, and parentheses").optional().or(z.literal('')),
      jobTitle: z.string().optional(),
      language: z.enum(['en', 'ar']).optional(),
    }).parse(req.body);

    console.log('[Profile Update] User ID:', userId);
    console.log('[Profile Update] Request body:', req.body);
    console.log('[Profile Update] Parsed data:', updateData);

    // Check if email is already in use by another user
    if (updateData.email) {
      const existingUser = await db.query.users.findFirst({
        where: (u, { and, eq, ne }) => and(
          eq(u.email, updateData.email),
          ne(u.id, userId)
        ),
        columns: { id: true }
      });

      if (existingUser) {
        return res.status(409).json({ message: "Email is already in use" });
      }
    }

    // Map camelCase to schema field names
    const dbUpdateData: any = {};
    if (updateData.firstName !== undefined) dbUpdateData.firstName = updateData.firstName;
    if (updateData.lastName !== undefined) dbUpdateData.lastName = updateData.lastName;
    if (updateData.email !== undefined) dbUpdateData.email = updateData.email;
    if (updateData.phone !== undefined) dbUpdateData.phone = updateData.phone;
    if (updateData.jobTitle !== undefined) dbUpdateData.jobTitle = updateData.jobTitle;
    if (updateData.language !== undefined) dbUpdateData.language = updateData.language;
    dbUpdateData.updatedAt = new Date();

    console.log('[Profile Update] DB update data:', dbUpdateData);

    const [updatedUser] = await db
      .update(users)
      .set(dbUpdateData)
      .where(eq(users.id, userId))
      .returning();

    console.log('[Profile Update] Updated user:', updatedUser);

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(updatedUser);
  } catch (error) {
    console.error("Error updating user profile:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid request data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to update profile" });
  }
});

// GET /api/users/:userId/stats - Get user statistics
router.get("/:userId/stats", requireAuth, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId;

    // Users can only view their own stats
    if (userId !== currentUserId) {
      return res.status(403).json({ message: "You can only view your own statistics" });
    }

    // Import projects and sql from schema
    const { projects } = await import('@shared/schema');
    const { sql, count } = await import('drizzle-orm');

    // Count projects owned by the user
    const projectCountResult = await db
      .select({ count: count() })
      .from(projects)
      .where(eq(projects.ownerId, userId));

    // Count tasks assigned to the user
    const taskCountResult = await db
      .select({ count: count() })
      .from(tasks)
      .where(eq(tasks.assigneeId, userId));

    res.json({
      projectCount: Number(projectCountResult[0]?.count || 0),
      taskCount: Number(taskCountResult[0]?.count || 0),
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({ message: "Failed to fetch statistics" });
  }
});

export default router;