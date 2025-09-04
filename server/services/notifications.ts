import { db } from "../db";
import { commentSubscriptions, users } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { emailService } from "../emailService";

export interface CommentNotificationData {
  comment: any;
  mentions: { userIds: number[]; users?: any[] };
  edited?: boolean;
}

export async function notifyComment({ comment, mentions, edited = false }: CommentNotificationData) {
  try {
    // 1) WebSocket broadcast to room `${orgId}:${targetType}:${targetId}`
    await broadcastComment(comment);

    // 2) Email: to mentioned users + subscribers (excluding author)
    const subscribers = await db.select()
      .from(commentSubscriptions)
      .where(and(
        eq(commentSubscriptions.organizationId, comment.organizationId),
        eq(commentSubscriptions.targetType, comment.targetType),
        eq(commentSubscriptions.targetId, comment.targetId)
      ));

    const recipientIds = new Set<number>([
      ...mentions.userIds,
      ...subscribers.map(s => s.userId)
    ]);
    
    // Remove comment author from recipients
    recipientIds.delete(comment.authorId);

    if (recipientIds.size > 0) {
      // Get user emails
      const recipients = await db.select({
        id: users.id,
        email: users.email,
        name: users.name,
        language: users.language,
      })
        .from(users)
        .where(and(
          inArray(users.id, Array.from(recipientIds).map(String)),
          eq(users.organizationId, comment.organizationId)
        ));

      // Send email notifications
      for (const recipient of recipients) {
        if (recipient.email) {
          const subject = edited 
            ? `[Ambersand] Comment edited on ${comment.targetType} #${comment.targetId}`
            : `[Ambersand] New comment on ${comment.targetType} #${comment.targetId}`;

          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
              <h2>${edited ? 'Comment Updated' : 'New Comment'}</h2>
              <p><strong>${comment.authorName || 'Someone'}</strong> ${edited ? 'updated a comment' : 'commented'} on ${comment.targetType} #${comment.targetId}:</p>
              <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
                ${formatCommentBody(comment.body)}
              </div>
              <p>
                <a href="${buildDeepLink(comment)}" style="background: #2699A6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                  View ${comment.targetType.charAt(0).toUpperCase() + comment.targetType.slice(1)}
                </a>
              </p>
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
              <p style="color: #666; font-size: 12px;">
                This notification was sent because you are subscribed to updates on this ${comment.targetType} or were mentioned in the comment.
              </p>
            </div>
          `;

          try {
            await emailService.sendEmailWithRetry({
              to: recipient.email,
              subject,
              html,
            });
          } catch (emailError) {
            console.error(`Failed to send comment notification to ${recipient.email}:`, emailError);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error in notifyComment:', error);
  }
}

// WebSocket broadcast (placeholder - will implement with existing WS infrastructure)
async function broadcastComment(comment: any) {
  try {
    // TODO: Implement WebSocket broadcast to room `${orgId}:${targetType}:${targetId}`
    const room = `${comment.organizationId}:${comment.targetType}:${comment.targetId}`;
    console.log(`📡 Broadcasting comment to room: ${room}`, { 
      commentId: comment.id, 
      targetType: comment.targetType, 
      targetId: comment.targetId 
    });
    
    // This will be implemented when WebSocket infrastructure is ready
    // wss.clients.forEach((client: WebSocket & { room?: string }) => {
    //   if (client.readyState === 1 && client.room === room) {
    //     client.send(JSON.stringify({ type: "comment:new", payload: comment }));
    //   }
    // });
  } catch (error) {
    console.error('Error broadcasting comment:', error);
  }
}

// Build deep link to the target (task or project)
function buildDeepLink(comment: any): string {
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:5000';
  
  if (comment.targetType === 'task') {
    return `${baseUrl}/tasks/${comment.targetId}`;
  } else if (comment.targetType === 'project') {
    return `${baseUrl}/projects/${comment.targetId}`;
  }
  
  return baseUrl;
}

// Format comment body for email (basic HTML conversion)
function formatCommentBody(body: string): string {
  if (!body) return '';
  
  // Escape HTML
  const escaped = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
  
  // Convert newlines to <br>
  const withBreaks = escaped.replace(/\n/g, '<br>');
  
  // Convert @mentions to bold
  const withMentions = withBreaks.replace(/@([\w.\-]+)/g, '<strong>@$1</strong>');
  
  return withMentions;
}