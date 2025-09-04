import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Check, ChevronDown, Mail, UserPlus, X } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

interface User {
  id: string; // string per specification
  email: string;
  name: string;
  avatarUrl?: string | null;
}

// Per specification: resolve returns either existing user or invite
type Resolve =
  | { type: "existing"; userId: string; email: string; name?: string }
  | { type: "invite"; inviteId: number; email: string };

interface AssigneeSmartInputProps {
  value?: string;
  onResolve: (result: Resolve) => void;
  onClear?: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function AssigneeSmartInput({ 
  value = '', 
  onResolve, 
  onClear,
  placeholder = "Type a name or email...",
  disabled = false
}: AssigneeSmartInputProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  const { toast } = useToast();

  // Debounced search for users
  const { data: searchResults = { items: [] }, isLoading } = useQuery({
    queryKey: ['/api/users/search', query],
    queryFn: ({ queryKey }) => {
      const [, searchQuery] = queryKey;
      if (!searchQuery || searchQuery.length < 2) return { items: [] };
      return fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}&limit=8`).then(r => r.json());
    },
    enabled: query.length >= 2 && open,
  });

  // Invite mutation
  const inviteMutation = useMutation({
    mutationFn: (email: string) => apiRequest('/api/users/invite', 'POST', { email, role: 'member' }),
    onSuccess: (data, email) => {
      toast({ 
        title: 'Invitation sent', 
        description: `Invitation sent to ${email}. The task will be assigned when they join.` 
      });
      onResolve({ type: 'invite', inviteId: data.inviteId, email });
      setOpen(false);
    },
    onError: (error: any) => {
      // Handle case where user already exists
      if (error?.status === 409 && error?.data?.userId) {
        const existingUser = searchResults.items.find((u: User) => u.id === error.data.userId);
        if (existingUser) {
          handleUserSelect(existingUser);
          return;
        }
      }
      
      toast({ 
        title: 'Failed to send invitation', 
        description: error?.data?.message || 'Something went wrong',
        variant: 'destructive' 
      });
    }
  });

  const handleUserSelect = useCallback((user: User) => {
    setSelectedUser(user);
    setQuery(user.name);
    onResolve({ type: 'existing', userId: user.id, email: user.email, name: user.name });
    setOpen(false);
    toast({ title: 'Assignee set', description: `Assignee set to ${user.name}` });
  }, [onResolve, toast]);

  const handleInviteEmail = useCallback((email: string) => {
    inviteMutation.mutate(email);
  }, [inviteMutation]);

  const handleClear = useCallback(() => {
    setSelectedUser(null);
    setQuery('');
    onClear?.();
  }, [onClear]);

  // Update query when value prop changes
  useEffect(() => {
    if (value !== query) {
      setQuery(value);
    }
  }, [value]);

  // Check if query looks like a valid email
  const isValidEmail = (str: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(str.trim());
  };

  const showInviteOption = query.length >= 5 && 
    isValidEmail(query) && 
    !searchResults.items.some((user: User) => 
      user.email.toLowerCase() === query.toLowerCase().trim()
    );

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between",
              selectedUser && "border-green-500 bg-green-50 dark:bg-green-900/20"
            )}
            disabled={disabled}
          >
            {selectedUser ? (
              <div className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={selectedUser.avatarUrl || undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(selectedUser.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{selectedUser.name}</span>
                <Badge variant="outline" className="text-xs">Assigned</Badge>
              </div>
            ) : (
              <span className="text-muted-foreground truncate">
                {query || placeholder}
              </span>
            )}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput 
              placeholder="Search users or enter email..."
              value={query}
              onValueChange={setQuery}
            />
            <CommandEmpty>
              {isLoading ? 'Searching...' : 'No users found.'}
            </CommandEmpty>
            
            {searchResults.items.length > 0 && (
              <CommandGroup heading="Existing Users">
                {searchResults.items.map((user: User) => (
                  <CommandItem
                    key={user.id}
                    onSelect={() => handleUserSelect(user)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={user.avatarUrl || undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{user.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                      </div>
                      <Check className="h-4 w-4 opacity-0 group-data-[selected]:opacity-100" />
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            
            {showInviteOption && (
              <CommandGroup heading="Invite New User">
                <CommandItem
                  onSelect={() => handleInviteEmail(query.trim())}
                  className="cursor-pointer"
                  disabled={inviteMutation.isPending}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <UserPlus className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">Invite {query.trim()}</div>
                      <div className="text-xs text-muted-foreground">
                        Send an invite and assign later
                      </div>
                    </div>
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CommandItem>
              </CommandGroup>
            )}
          </Command>
        </PopoverContent>
      </Popover>
      
      {selectedUser && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}