import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

interface User {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  profileImageUrl?: string;
}

interface UserAvatarProps {
  user: User;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function UserAvatar({ user, size = 'md', className }: UserAvatarProps) {
  console.log('[UserAvatar] Rendering with profileImageUrl:', user.profileImageUrl);

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  };

  const getInitials = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
    }
    if (user.name) {
      const names = user.name.split(' ');
      if (names.length >= 2) {
        return `${names[0].charAt(0)}${names[1].charAt(0)}`.toUpperCase();
      }
      return names[0].charAt(0).toUpperCase();
    }
    if (user.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return '?';
  };

  // Add cache-busting parameter only when profileImageUrl changes
  const imageUrlWithCacheBust = useMemo(() => {
    if (!user.profileImageUrl) return undefined;
    return `${user.profileImageUrl}?v=${Date.now()}`;
  }, [user.profileImageUrl]);

  return (
    <Avatar className={cn(sizeClasses[size], className)} key={imageUrlWithCacheBust}>
      <AvatarImage
        src={imageUrlWithCacheBust}
        alt={user.name || user.email || 'User'}
        key={imageUrlWithCacheBust}
      />
      <AvatarFallback>{getInitials(user)}</AvatarFallback>
    </Avatar>
  );
}