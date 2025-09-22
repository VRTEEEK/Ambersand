import { db } from "../db";
import { commentSubscriptions, users, notifications } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { emailService } from "../emailService";

export interface CommentNotificationData {
  comment: any;
  mentions: { userIds: string[]; users?: any[] };
  edited?: boolean;
}

export async function notifyComment({ comment, mentions, edited = false }: CommentNotificationData) {
  try {
    console.log('🔔 notifyComment called with:', {
      commentId: comment.id,
      organizationId: comment.organizationId,
      mentions: mentions,
      mentionUserIds: mentions.userIds,
      mentionUsersCount: mentions.userIds?.length || 0,
      edited
    });

    // 1) WebSocket broadcast to room `${orgId}:${targetType}:${targetId}`
    await broadcastComment(comment);

    // 2) Create in-app notifications and send emails to mentioned users + subscribers (excluding author)
    const subscribers = await db.select()
      .from(commentSubscriptions)
      .where(and(
        eq(commentSubscriptions.organizationId, comment.organizationId),
        eq(commentSubscriptions.targetType, comment.targetType),
        eq(commentSubscriptions.targetId, comment.targetId)
      ));

    console.log('📫 Found subscribers:', subscribers.length);

    const recipientIds = new Set<string>([
      ...mentions.userIds,
      ...subscribers.map(s => s.userId)
    ]);
    
    console.log('👥 Recipients before filtering:', Array.from(recipientIds));
    
    // Remove comment author from recipients
    recipientIds.delete(comment.authorId);
    
    console.log('👥 Recipients after filtering (excluding author):', Array.from(recipientIds));

    if (recipientIds.size > 0) {
      console.log('✅ Processing notifications for', recipientIds.size, 'recipients');
      // Get user emails
      const recipients = await db.select({
        id: users.id,
        email: users.email,
        name: users.name,
        language: users.language,
      })
        .from(users)
        .where(and(
          inArray(users.id, Array.from(recipientIds)),
          eq(users.organizationId, comment.organizationId)
        ));

      // Create in-app notifications for each recipient
      for (const recipient of recipients) {
        const isMention = mentions.userIds.includes(recipient.id);
        const notificationType = isMention ? 'mention' : 'comment';
        const title = isMention ? 'You were mentioned' : 'New comment';
        const message = edited 
          ? `${comment.authorName || 'Someone'} edited a comment where you were mentioned`
          : `${comment.authorName || 'Someone'} ${isMention ? 'mentioned you' : 'commented'} on ${comment.targetType} #${comment.targetId}`;
        
        console.log(`📩 Creating notification for user ${recipient.id}:`, {
          type: notificationType,
          title,
          message,
          isMention
        });
        
        try {
          await db.insert(notifications).values({
            organizationId: comment.organizationId,
            userId: recipient.id,
            type: notificationType,
            title,
            message,
            actionUrl: buildDeepLink(comment),
            isRead: false,
          });
          console.log(`✅ Notification created for user ${recipient.id}`);
        } catch (dbError) {
          console.error(`❌ Failed to create notification for user ${recipient.id}:`, dbError);
        }
      }

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

          console.log(`📧 Sending email notification to ${recipient.email}`);
          try {
            await emailService.sendEmailWithRetry({
              to: recipient.email,
              subject,
              html,
            });
            console.log(`✅ Email sent to ${recipient.email}`);
          } catch (emailError) {
            console.error(`❌ Failed to send comment notification to ${recipient.email}:`, emailError);
          }
        }
      }
      
      console.log(`🔍 Found ${recipients.length} recipient users in database`);
    } else {
      console.log('⚠️ No recipients to notify');
    }
  } catch (error) {
    console.error('❌ Error in notifyComment:', error);
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