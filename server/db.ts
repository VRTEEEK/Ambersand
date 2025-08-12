import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Create a logging wrapper for the database with email notification for tasks
const originalDb = drizzle({ client: pool, schema });
export const db = new Proxy(originalDb, {
  get(target, prop) {
    if (prop === 'insert') {
      return function(table: any) {
        const tableName = table[Symbol.for('drizzle:Name')] || 'unknown';
        console.log('💾💾💾 DB.INSERT called on table:', tableName);
        
        const insertOperation = target.insert(table);
        
        // If this is a task insert, add email notification
        if (tableName === 'tasks') {
          return {
            ...insertOperation,
            values: function(values: any) {
              const originalValues = insertOperation.values.call(insertOperation, values);
              return {
                ...originalValues,
                returning: function() {
                  const originalReturning = originalValues.returning.call(originalValues);
                  
                  // Hook into the promise to send email after task creation
                  const originalThen = originalReturning.then.bind(originalReturning);
                  originalReturning.then = function(onResolve: any, onReject: any) {
                    return originalThen((result: any) => {
                      // Send email notification for new task
                      if (result && result.length > 0 && result[0].assigneeId) {
                        console.log('🔥🔥🔥 DB-LEVEL: Task created with assignee, sending email...');
                        // Import and send email asynchronously
                        import("./emailService").then(async ({ emailService }) => {
                          try {
                            const { storage } = await import("./storage");
                            const task = result[0];
                            const assignedUser = await storage.getUser(task.assigneeId);
                            
                            if (assignedUser && assignedUser.email) {
                              const project = task.projectId ? await storage.getProject(task.projectId) : null;
                              const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Not set';
                              const projectName = project?.name || 'Untitled Project';
                              
                              const template = emailService.templates.taskAssignment(
                                assignedUser.firstName || assignedUser.name || 'User',
                                task.title,
                                dueDate,
                                projectName,
                                (assignedUser.language as 'en' | 'ar') || 'en',
                                task.id
                              );
                              
                              await emailService.sendEmail({
                                to: assignedUser.email,
                                subject: template.subject,
                                html: template.html,
                              });
                              
                              console.log(`✅ DB-LEVEL: Email sent successfully to ${assignedUser.email}`);
                            }
                          } catch (error) {
                            console.error('❌ DB-LEVEL: Email failed:', error);
                          }
                        });
                      }
                      
                      if (onResolve) return onResolve(result);
                      return result;
                    }, onReject);
                  };
                  
                  return originalReturning;
                }
              };
            }
          };
        }
        
        return insertOperation;
      };
    }
    return target[prop as keyof typeof target];
  }
});