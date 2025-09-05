import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { users, userInvites, tasks } from "@shared/schema";
import { isAuthenticated } from "../replitAuth";
import { and, eq, ilike, or } from "drizzle-orm";
import email from "../email";
import crypto from "crypto";

const router = Router();

// GET /api/users - Get all users in organization (for workflows, assignments, etc)
router.get("/", isAuthenticated, async (req: any, res) => {
  try {
    const orgId = req.user?.organizationId || 'default';
    
    const allUsers = await db.query.users.findMany({
      where: eq(users.organizationId, orgId),
      columns: { 
        id: true, 
        email: true, 
        name: true, 
        firstName: true, 
        lastName: true, 
        profileImageUrl: true,
        profilePicture: true 
      },
      orderBy: (users, { desc }) => [desc(users.createdAt)]
    });

    const formattedUsers = allUsers.map(user => ({
      id: user.id,
      email: user.email || '',
      name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      profilePicture: user.profilePicture || user.profileImageUrl || null
    }));
    
    res.json(formattedUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// Debug endpoint to see what the server thinks about auth
router.get("/me", isAuthenticated, (req: any, res) => {
  res.json({
    userId: req.user?.id,
    org: req.user?.claims?.org,
    organizationId: req.user?.organizationId,
    roles: req.user?.roles || [],
    claims: req.user?.claims || null,
  });
});

// Debug endpoint for search issues  
router.get("/search/debug", isAuthenticated, async (req: any, res) => {
  const q = String(req.query.q || "").trim();
  res.json({
    gotCookie: !!req.headers.cookie,
    org: req.user?.claims?.org || null,
    organizationId: req.user?.organizationId || null,
    q,
    userObject: req.user,
  });
});

router.get("/search", isAuthenticated, async (req: any, res) => {
  const q = String(req.query.q || "").trim();
  const limit = Math.min(Number(req.query.limit || 8), 25);
  const orgId = req.user?.claims?.org || req.user?.organizationId || 'default';

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
router.post("/invite", isAuthenticated, async (req: any, res) => {
  const inviteEmail = String(req.body?.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
    return res.status(400).json({ message: "Invalid email" });
  }
  // Use organization from claims.org or user.organizationId - no fallbacks
  const orgId = req.user?.claims?.org || req.user?.organizationId;
  if (!orgId) {
    return res.status(400).json({ message: "Organization missing" });
  }

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
        inviterName: req.user?.firstName || req.user?.email?.split('@')[0] || 'Someone'
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

// POST /api/users/invite/accept { token }
// Accept invite and auto-assign pending tasks per specification
router.post("/invite/accept", isAuthenticated, async (req: any, res) => {
  try {
    const { token } = z.object({ token: z.string().min(10) }).parse(req.body);

    const [invite] = await db.select().from(userInvites)
      .where(and(eq(userInvites.token, token), eq(userInvites.accepted, false)));
    
    if (!invite) {
      return res.status(400).json({ message: "Invalid or expired invite" });
    }

    // Ensure current user belongs to same org
    if (req.user.claims.org !== invite.organizationId) {
      return res.status(403).json({ message: "Wrong organization" });
    }

    // Mark invite as accepted
    await db.update(userInvites).set({ 
      accepted: true, 
      acceptedAt: new Date() 
    }).where(eq(userInvites.id, invite.id));

    // Move all tasks with pendingAssigneeInviteId → assigneeId = current user
    const updated = await db.update(tasks)
      .set({ 
        assigneeId: req.user.id, 
        pendingAssigneeInviteId: null, 
        updatedAt: new Date() 
      })
      .where(eq(tasks.pendingAssigneeInviteId, invite.id))
      .returning({ id: tasks.id, title: tasks.title });

    res.json({ success: true, assignedTasks: updated });
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

export default router;