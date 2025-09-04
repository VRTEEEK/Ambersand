import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { users, userInvites, tasks } from "@shared/schema";
import { isAuthenticated } from "../replitAuth";
import { and, eq, ilike, or } from "drizzle-orm";
import { emailService } from "../emailService";
import crypto from "crypto";

const router = Router();

// GET /api/users/search?q=<query>&limit=8
// Returns existing org users for autocomplete
router.get("/search", isAuthenticated, async (req: any, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(Number(req.query.limit || 8), 25);
    
    if (!q) {
      return res.json({ items: [] });
    }

    // Lookup by name or email in same org
    const items = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      firstName: users.firstName,
      lastName: users.lastName,
      profileImageUrl: users.profileImageUrl,
    })
      .from(users)
      .where(and(
        eq(users.organizationId, req.user.claims?.org || ''),
        or(
          ilike(users.email, `%${q}%`),
          ilike(users.name, `%${q}%`),
          ilike(users.firstName, `%${q}%`),
          ilike(users.lastName, `%${q}%`)
        )
      ))
      .limit(limit);

    const formattedItems = items.map(user => ({
      id: user.id, // Keep as string per specification
      email: user.email || '',
      name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User',
      avatarUrl: user.profileImageUrl || null,
    }));

    res.json({ items: formattedItems });
  } catch (error) {
    console.error("Error searching users:", error);
    res.status(500).json({ message: "Failed to search users" });
  }
});

// POST /api/users/invite { email, role? }
router.post("/invite", isAuthenticated, async (req: any, res) => {
  try {
    const schema = z.object({
      email: z.string().email("Invalid email format"),
      role: z.string().default("member"),
    });

    const { email, role } = schema.parse(req.body);
    const normalizedEmail = email.trim().toLowerCase();

    // If user already exists in org, return conflict with userId
    const existing = await db.select({
      id: users.id,
    })
      .from(users)
      .where(and(
        eq(users.organizationId, req.user.claims?.org || ''),
        eq(users.email, normalizedEmail)
      ))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ 
        message: "Already a user", 
        userId: existing[0].id // Keep as string per specification
      });
    }

    // Check if there's already a pending invite for this email
    const existingInvite = await db.select({
      id: userInvites.id,
    })
      .from(userInvites)
      .where(and(
        eq(userInvites.organizationId, req.user.claims?.org || ''),
        eq(userInvites.email, normalizedEmail),
        eq(userInvites.accepted, false)
      ))
      .limit(1);

    if (existingInvite.length > 0) {
      return res.status(409).json({
        message: "Invite already sent to this email",
        inviteId: existingInvite[0].id
      });
    }

    // Create invite
    const token = crypto.randomUUID().replace(/-/g, "");
    const [invite] = await db.insert(userInvites).values({
      organizationId: req.user.claims?.org || '',
      email: normalizedEmail,
      role,
      token,
    }).returning();

    // Send email
    const acceptUrl = `${process.env.APP_BASE_URL || "http://localhost:5000"}/accept-invite?token=${token}`;
    
    try {
      await emailService.sendEmailWithRetry({
        to: normalizedEmail,
        subject: "You're invited to Ambersand",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2699A6;">You're invited to Ambersand</h2>
            <p>You've been invited to join the Ambersand compliance management platform.</p>
            <p>Ambersand helps organizations manage their cybersecurity compliance efficiently with automated workflows, task management, and comprehensive reporting.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${acceptUrl}" style="background: #2699A6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Accept Your Invite
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              This invitation link will expire in 7 days. If you have any questions, please contact your organization administrator.
            </p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">
              If you're unable to click the button above, copy and paste this URL into your browser:<br>
              <a href="${acceptUrl}">${acceptUrl}</a>
            </p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("Failed to send invite email:", emailError);
      // Continue anyway - the invite is created, email can be retried
    }

    res.status(201).json({ 
      inviteId: invite.id,
      message: "Invitation sent successfully" 
    });
  } catch (error) {
    console.error("Error creating invite:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid request data", errors: error.issues });
    }
    res.status(500).json({ message: "Failed to create invite" });
  }
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