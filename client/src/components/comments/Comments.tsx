import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Edit2, Trash2, Send, AtSign, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { apiRequest } from '@/lib/queryClient';

interface Comment {
  id: number;
  organizationId: string;
  targetType: 'task' | 'project' | 'risk';
  targetId: number;
  parentId?: number | null;
  authorId: string;
  body: string;
  mentions: string;
  hasAttachments: boolean;
  createdAt: string;
  updatedAt: string;
  authorName?: string;
  authorEmail?: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  handle: string;
}

interface CommentsProps {
  targetType: 'task' | 'project' | 'risk';
  targetId: number;
}

export default function Comments({ targetType, targetId }: CommentsProps) {
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const commentsQuery = useQuery({
    queryKey: ['/api/comments', targetType, targetId],
    queryFn: ({ queryKey }) => {
      const [, type, id] = queryKey;
      return fetch(`/api/comments?targetType=${type}&targetId=${id}&limit=50`).then(r => r.json());
    }
  });

  const usersQuery = useQuery({
    queryKey: ['/api/comments/users/search', mentionQuery],
    queryFn: ({ queryKey }) => {
      const [, , query] = queryKey;
      if (!query || query.length < 2) return { users: [] };
      return fetch(`/api/comments/users/search?q=${encodeURIComponent(query)}&limit=10`).then(r => r.json());
    },
    enabled: showMentions && mentionQuery.length >= 2,
  });

  const createMutation = useMutation({
    mutationFn: (body: string) => apiRequest('/api/comments', 'POST', { targetType, targetId, body }),
    onSuccess: (newComment) => {
      setText('');
      queryClient.setQueryData(['/api/comments', targetType, targetId], (old: any) => ({
        ...old,
        items: [newComment, ...(old?.items || [])]
      }));
      toast({ title: 'Comment posted' });
    },
    onError: () => {
      toast({ title: 'Failed to post comment', variant: 'destructive' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) => 
      apiRequest(`/api/comments/${id}`, 'PATCH', { body }),
    onSuccess: (updatedComment) => {
      setEditingId(null);
      setEditText('');
      queryClient.setQueryData(['/api/comments', targetType, targetId], (old: any) => ({
        ...old,
        items: old?.items?.map((item: Comment) => 
          item.id === (updatedComment as Comment).id ? updatedComment : item
        ) || []
      }));
      toast({ title: 'Comment updated' });
    },
    onError: () => {
      toast({ title: 'Failed to update comment', variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/comments/${id}`, 'DELETE'),
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData(['/api/comments', targetType, targetId], (old: any) => ({
        ...old,
        items: old?.items?.filter((item: Comment) => item.id !== deletedId) || []
      }));
      toast({ title: 'Comment deleted' });
    },
    onError: () => {
      toast({ title: 'Failed to delete comment', variant: 'destructive' });
    }
  });

  const handleSend = useCallback(() => {
    const body = text.trim();
    if (!body) return;
    createMutation.mutate(body);
  }, [text, createMutation]);

  const handleUpdate = useCallback((id: number) => {
    const body = editText.trim();
    if (!body) return;
    updateMutation.mutate({ id, body });
  }, [editText, updateMutation]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>, id: number) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleUpdate(id);
    }
    if (e.key === 'Escape') {
      setEditingId(null);
      setEditText('');
    }
  }, [handleUpdate]);

  const handleTextChange = useCallback((value: string) => {
    setText(value);
    
    // Check for @ mentions
    const textarea = textareaRef.current;
    if (textarea) {
      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = value.slice(0, cursorPos);
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');
      
      if (lastAtIndex !== -1) {
        const afterAt = textBeforeCursor.slice(lastAtIndex + 1);
        if (!afterAt.includes(' ') && !afterAt.includes('\n')) {
          setMentionQuery(afterAt);
          setShowMentions(true);
          setCursorPosition(cursorPos);
          return;
        }
      }
    }
    
    setShowMentions(false);
    setMentionQuery('');
  }, []);

  const insertMention = useCallback((user: User) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const beforeCursor = text.slice(0, cursorPosition);
    const afterCursor = text.slice(cursorPosition);
    const lastAtIndex = beforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const beforeAt = beforeCursor.slice(0, lastAtIndex);
      const mention = `@${user.handle}`;
      const newText = beforeAt + mention + ' ' + afterCursor;
      setText(newText);
      
      // Set cursor position after the mention
      setTimeout(() => {
        const newCursorPos = beforeAt.length + mention.length + 1;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }, 0);
    }
    
    setShowMentions(false);
    setMentionQuery('');
  }, [text, cursorPosition]);

  const startEdit = useCallback((comment: Comment) => {
    setEditingId(comment.id);
    setEditText(comment.body);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditText('');
  }, []);

  const formatCommentBody = useCallback((body: string | null | undefined) => {
    // Ensure body is a string before processing
    if (!body || typeof body !== 'string') {
      return '';
    }
    
    // Simple formatting: newlines to <br> and @mentions to bold
    const escaped = body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    const withBreaks = escaped.replace(/\n/g, '<br>');
    const withMentions = withBreaks.replace(/@([\w.\-]+)/g, '<strong class="text-blue-600">@$1</strong>');
    
    return withMentions;
  }, []);

  const getInitials = useCallback((name?: string, email?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'U';
  }, []);

  const comments = commentsQuery.data?.items || [];
  const users = usersQuery.data?.users || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <MessageCircle className="h-4 w-4" />
        Comments ({comments.length})
      </div>

      {/* Comment composer */}
      <Card>
        <CardContent className="pt-4">
          <div className="space-y-3">
            <div className="relative">
              <Textarea
                ref={textareaRef}
                placeholder="Write a comment... Use @ to mention someone"
                value={text}
                onChange={(e) => handleTextChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="min-h-[80px] resize-none"
              />
              
              {/* Mentions popover */}
              <Popover open={showMentions} onOpenChange={setShowMentions}>
                <PopoverTrigger asChild>
                  <div className="absolute bottom-2 left-2 opacity-0 pointer-events-none">
                    <AtSign className="h-4 w-4" />
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search users..." value={mentionQuery} />
                    <CommandEmpty>No users found.</CommandEmpty>
                    <CommandGroup>
                      {users.map((user: any) => (
                        <CommandItem
                          key={user.id}
                          onSelect={() => insertMention(user)}
                          className="cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {getInitials(user.name, user.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="text-sm font-medium">{user.name}</div>
                              <div className="text-xs text-muted-foreground">@{user.handle}</div>
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="flex justify-between items-center">
              <div className="text-xs text-muted-foreground">
                Press Enter to send, Shift+Enter for new line
              </div>
              <Button 
                onClick={handleSend} 
                disabled={!text.trim() || createMutation.isPending}
                size="sm"
              >
                <Send className="h-4 w-4 mr-1" />
                Send
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comments list */}
      <div className="space-y-3">
        {commentsQuery.isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading comments...
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No comments yet. Be the first to comment!
          </div>
        ) : (
          comments.map((comment: Comment) => (
            <Card key={comment.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {getInitials(comment.authorName, comment.authorEmail)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-medium">
                        {comment.authorName || comment.authorEmail || 'Unknown User'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(comment.createdAt).toLocaleString()}
                        {comment.updatedAt !== comment.createdAt && (
                          <span className="ml-1">(edited)</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => startEdit(comment)}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => deleteMutation.mutate(comment.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                {editingId === comment.id ? (
                  <div className="space-y-2">
                    <Textarea
                      ref={editTextareaRef}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => handleEditKeyDown(e, comment.id)}
                      className="min-h-[60px]"
                    />
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => handleUpdate(comment.id)}
                        disabled={!editText.trim() || updateMutation.isPending}
                      >
                        Save
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={cancelEdit}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: formatCommentBody(comment.body) }}
                  />
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}