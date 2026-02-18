import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { UserProfile } from '@/types';

interface UserAvatarProps {
  user: Partial<Pick<UserProfile, 'firstName' | 'lastName' | 'photoURL'>>;
}

export default function UserAvatar({ user }: UserAvatarProps) {
  const getInitials = () => {
    const first = user.firstName ? user.firstName[0] : '';
    const last = user.lastName ? user.lastName[0] : '';
    return `${first}${last}`.toUpperCase();
  };

  return (
    <Avatar className="h-10 w-10">
      <AvatarImage src={user.photoURL || ''} alt={`${user.firstName || ''} ${user.lastName || ''}`} />
      <AvatarFallback>{getInitials()}</AvatarFallback>
    </Avatar>
  );
}
