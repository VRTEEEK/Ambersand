import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/hooks/use-i18n';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  User, 
  Activity,
  Loader2 
} from 'lucide-react';
import { format } from 'date-fns';

interface AuditEvent {
  id: string;
  event_type: string;
  description: string;
  user_id?: string;
  target_user_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
  performed_by?: {
    id: string;
    name?: string;
    email: string;
  };
}

interface AuditResponse {
  events: AuditEvent[];
  total: number;
  page: number;
  pageSize: number;
}

interface AuditModalProps {
  userId: string;
  userName: string;
  open: boolean;
  onClose: () => void;
}

export default function AuditModal({ userId, userName, open, onClose }: AuditModalProps) {
  const { t, isRTL } = useI18n();
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: auditData, isLoading } = useQuery<AuditResponse>({
    queryKey: ['/api/admin/users', userId, 'audit', page, pageSize],
    queryFn: () => fetch(`/api/admin/users/${userId}/audit?page=${page}&page_size=${pageSize}`)
      .then(res => res.json()),
    enabled: open && !!userId,
  });

  const getEventTypeDisplay = (eventType: string) => {
    const eventTypes = {
      'role_assigned': t('audit.roleAssigned'),
      'role_removed': t('audit.roleRemoved'),
      'status_changed': t('audit.statusChanged'),
      'password_reset': t('audit.passwordReset'),
      'login': t('audit.login'),
      'logout': t('audit.logout'),
      'created': t('audit.userCreated'),
      'updated': t('audit.userUpdated'),
      'deleted': t('audit.userDeleted'),
    };
    return eventTypes[eventType as keyof typeof eventTypes] || eventType;
  };

  const getEventTypeVariant = (eventType: string) => {
    const variants = {
      'role_assigned': 'default',
      'role_removed': 'secondary',
      'status_changed': 'outline',
      'password_reset': 'destructive',
      'login': 'default',
      'logout': 'secondary',
      'created': 'default',
      'updated': 'outline',
      'deleted': 'destructive',
    };
    return variants[eventType as keyof typeof variants] || 'outline';
  };

  const totalPages = auditData ? Math.ceil(auditData.total / pageSize) : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {t('users.auditLog')}
          </DialogTitle>
          <DialogDescription>
            {t('users.auditLogDescription', { userName })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col">
          {isLoading ? (
            <div className="flex items-center justify-center flex-1">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : auditData && auditData.events.length > 0 ? (
            <>
              <ScrollArea className="flex-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">{t('audit.timestamp')}</TableHead>
                      <TableHead className="w-[140px]">{t('audit.eventType')}</TableHead>
                      <TableHead>{t('audit.description')}</TableHead>
                      <TableHead className="w-[160px]">{t('audit.performedBy')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditData.events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="font-mono text-xs">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(event.created_at), 'MMM dd, HH:mm')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getEventTypeVariant(event.event_type) as any} className="text-xs">
                            {getEventTypeDisplay(event.event_type)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {event.description}
                            {event.metadata && Object.keys(event.metadata).length > 0 && (
                              <details className="mt-1">
                                <summary className="text-xs text-slate-500 cursor-pointer">
                                  {t('audit.details')}
                                </summary>
                                <pre className="text-xs bg-slate-50 dark:bg-slate-800 p-2 rounded mt-1 overflow-x-auto">
                                  {JSON.stringify(event.metadata, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {event.performed_by ? (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <div className="text-xs">
                                <div className="font-medium">
                                  {event.performed_by.name || event.performed_by.email}
                                </div>
                                {event.performed_by.name && (
                                  <div className="text-slate-500">
                                    {event.performed_by.email}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">{t('audit.system')}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Pagination */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-slate-600">
                  {t('pagination.showing', {
                    start: (page - 1) * pageSize + 1,
                    end: Math.min(page * pageSize, auditData.total),
                    total: auditData.total
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {t('pagination.previous')}
                  </Button>
                  <span className="text-sm">
                    {t('pagination.pageOf', { page, total: totalPages })}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    {t('pagination.next')}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center flex-1 text-slate-500">
              <div className="text-center">
                <Activity className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p>{t('users.noAuditEvents')}</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}