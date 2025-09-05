import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { comments, commentSubscriptions } from "@shared/comments";
import { users } from "@shared/schema";
import { isAuthenticated } from "../replitAuth";
import { and, eq, desc, isNull, lt } from "drizzle-orm";
import { parseMentions, searchUsersForMentions } from "../services/mentions";
import { notifyComment } from "../services/notifications";

const router = Router();

// Permission helpers
async function canViewTarget(user: any, targetType: string, targetId: number): Promise<boolean> {
  // For now, allow if user is authenticated - TODO: implement proper target-specific permissions
  return !!user;
}

async function canCommentTarget(user: any, targetType: string, targetId: number): Promise<boolean> {
  // For now, allow if user is authenticated - TODO: implement proper target-specific permissions  
  return !!user;
}

// GET list (paginated)
router.get("/", isAuthenticated, async (req: any, res) => {
  const schema = z.object({
    targetType: z.enum(["task", "project", "risk"]),
    targetId: z.coerce.number(),
    cursor: z.coerce.number().optional(), // comment id before which to load
    limit: z.coerce.number().min(1).max(100).default(50),
  });
  
  try {
    const q = schema.parse(req.query);
    
    // Check permissions
    if (!(await canViewTarget(req.user, q.targetType, q.targetId))) {
      return res.status(403).json({ message: "Access denied" });
    }

    const whereBase = and(
      eq(comments.organizationId, req.user.claims?.org || ''),
      eq(comments.targetType, q.targetType),
      eq(comments.targetId, q.targetId),
      isNull(comments.deletedAt)
    );
    
    const whereCondition = q.cursor 
      ? and(whereBase, lt(comments.id, q.cursor))
      : whereBase;

    const rows = await db.select({
      id: comments.id,
      organizationId: comments.organizationId,
      targetType: comments.targetType,
      targetId: comments.targetId,
      parentId: comments.parentId,
      authorId: comments.authorId,
      body: comments.body,
      mentions: comments.mentions,
      hasAttachments: comments.hasAttachments,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      authorName: users.name,
      authorFirstName: users.firstName,
      authorLastName: users.lastName,
      authorEmail: users.email,
    })
      .from(comments)
      .leftJoin(users, eq(comments.authorId, users.id))
      .where(whereCondition)
      .orderBy(desc(comments.id))
      .limit(q.limit);

    // Process rows to construct authorName if needed
    const processedRows = rows.map(row => ({
      ...row,
      authorName: row.authorName || 
                  (row.authorFirstName || row.authorLastName ? 
                   `${row.authorFirstName || ''} ${row.authorLastName || ''}`.trim() : 
                   null),
      // Remove the temporary fields
      authorFirstName: undefined,
      authorLastName: undefined,
    }));

    res.json({ 
      items: processedRows, 
      nextCursor: rows.length ? rows[rows.length - 1].id : null 
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(400).json({ message: "Invalid request" });
  }
});

// POST create
router.post("/", isAuthenticated, async (req: any, res) => {
  const schema = z.object({
    targetType: z.enum(["task", "project", "risk"]),
    targetId: z.number(),
    parentId: z.number().optional(),
    body: z.string().min(1).max(4000),
  });
  
  try {
    const body = schema.parse(req.body);
    
    // Check permissions
    if (!(await canCommentTarget(req.user, body.targetType, body.targetId))) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Parse mentions
    const mentions = await parseMentions(body.body, req.user.claims?.org || '');

    const [row] = await db.insert(comments).values({
      organizationId: req.user.claims?.org || '',
      targetType: body.targetType,
      targetId: body.targetId,
      parentId: body.parentId ?? null,
      authorId: req.user.claims?.sub || req.user.id,
      body: body.body,
      mentions: JSON.stringify(mentions.userIds),
    }).returning();

    // Auto-subscribe author
    await db.insert(commentSubscriptions).values({
      organizationId: req.user.claims?.org || '',
      targetType: body.targetType,
      targetId: body.targetId,
      userId: req.user.claims?.sub || req.user.id,
    }).onConflictDoNothing();

    // Get the created comment with author info
    const [commentWithAuthor] = await db.select({
      id: comments.id,
      organizationId: comments.organizationId,
      targetType: comments.targetType,
      targetId: comments.targetId,
      parentId: comments.parentId,
      authorId: comments.authorId,
      body: comments.body,
      mentions: comments.mentions,
      hasAttachments: comments.hasAttachments,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      authorName: users.name,
      authorFirstName: users.firstName,
      authorLastName: users.lastName,
      authorEmail: users.email,
    })
      .from(comments)
      .leftJoin(users, eq(comments.authorId, users.id))
      .where(eq(comments.id, row.id));

    // Process author name
    const processedComment = {
      ...commentWithAuthor,
      authorName: commentWithAuthor.authorName || 
                  (commentWithAuthor.authorFirstName || commentWithAuthor.authorLastName ? 
                   `${commentWithAuthor.authorFirstName || ''} ${commentWithAuthor.authorLastName || ''}`.trim() : 
                   null),
      // Remove the temporary fields
      authorFirstName: undefined,
      authorLastName: undefined,
    };

    // Notify via WebSocket and email
    await notifyComment({ comment: processedComment, mentions });

    res.status(201).json(processedComment);
  } catch (error) {
    console.error("Error creating comment:", error);
    res.status(400).json({ message: "Invalid request" });
  }
});

// PATCH edit (author only)
router.patch("/:id", isAuthenticated, async (req: any, res) => {
  const schema = z.object({ 
    body: z.string().min(1).max(4000) 
  });
  
  try {
    const { body } = schema.parse(req.body);
    const id = Number(req.params.id);
    
    const [existing] = await db.select().from(comments)
      .where(and(
        eq(comments.id, id), 
        eq(comments.organizationId, req.user.claims?.org || ''),
        isNull(comments.deletedAt)
      ));
      
    if (!existing) {
      return res.status(404).json({ message: "Comment not found" });
    }
    
    if (existing.authorId !== (req.user.claims?.sub || req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Access denied" });
    }

    // Parse mentions
    const mentions = await parseMentions(body, req.user.claims?.org || '');

    const [row] = await db.update(comments).set({
      body,
      mentions: JSON.stringify(mentions.userIds),
      updatedAt: new Date(),
    }).where(eq(comments.id, id)).returning();

    // Notify via WebSocket and email
    await notifyComment({ comment: row, mentions, edited: true });

    res.json(row);
  } catch (error) {
    console.error("Error updating comment:", error);
    res.status(400).json({ message: "Invalid request" });
  }
});

// DELETE (soft delete; author or admin)
router.delete("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    
    const [existing] = await db.select().from(comments)
      .where(and(
        eq(comments.id, id), 
        eq(comments.organizationId, req.user.claims?.org || ''),
        isNull(comments.deletedAt)
      ));
      
    if (!existing) {
      return res.status(404).json({ message: "Comment not found" });
    }
    
    if (existing.authorId !== (req.user.claims?.sub || req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Access denied" });
    }

    await db.update(comments).set({ 
      deletedAt: new Date() 
    }).where(eq(comments.id, id));
    
    res.sendStatus(204);
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(400).json({ message: "Invalid request" });
  }
});

// GET search users for mentions autocomplete
router.get("/users/search", isAuthenticated, async (req: any, res) => {
  const schema = z.object({
    q: z.string().min(1).max(100),
    limit: z.coerce.number().min(1).max(20).default(10),
  });
  
  try {
    const { q, limit } = schema.parse(req.query);
    const users = await searchUsersForMentions(q, req.user.claims?.org || '', limit);
    res.json({ users });
  } catch (error) {
    console.error("Error searching users:", error);
    res.status(400).json({ message: "Invalid request" });
  }
});

export default router;