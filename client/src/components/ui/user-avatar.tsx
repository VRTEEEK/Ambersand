import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  user?: {
    firstName?: string;
    lastName?: string;
    profileImageUrl?: string;
    email?: string;
  };
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

const sizeClasses = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
  xl: 'h-12 w-12',
  '2xl': 'h-20 w-20',
};

const textSizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-sm',
  xl: 'text-base',
  '2xl': 'text-xl',
};

export function UserAvatar({ user, size = 'md', className }: UserAvatarProps) {
  const getUserInitials = (firstName?: string, lastName?: string, email?: string) => {
    if (firstName || lastName) {
      return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return 'U';
  };

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarImage 
        src={user?.profileImageUrl} 
        alt={`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'User'}
        className="object-cover"
      />
      <AvatarFallback className={cn(
        "bg-[#2699A6]/10 text-[#2699A6] font-medium",
        textSizeClasses[size]
      )}>
        {getUserInitials(user?.firstName, user?.lastName, user?.email)}
      </AvatarFallback>
    </Avatar>
  );
}