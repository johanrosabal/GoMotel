'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useFirebase } from '@/firebase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { LogOut } from 'lucide-react';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Skeleton } from './ui/skeleton';

export default function UserMenu() {
  const { user, auth, isUserLoading } = useFirebase();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({
        title: 'Sesión Cerrada',
        description: 'Has cerrado sesión exitosamente.',
      });
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: 'Error',
        description: 'Error al cerrar sesión.',
        variant: 'destructive',
      });
    }
  };

  const isLoading = isUserLoading || (user && isProfileLoading);

  if (isLoading) {
    return (
        <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="hidden md:flex flex-col gap-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
            </div>
        </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" id="usermenu-button-1">
          <Link href="/" id="usermenu-link-iniciar-sesi-n">Iniciar Sesión</Link>
        </Button>
        <Button asChild size="sm" id="usermenu-button-2">
          <Link href="/register" id="usermenu-link-registrarse">Registrarse</Link>
        </Button>
      </div>
    );
  }

  const getInitials = () => {
    if (userProfile?.firstName && userProfile?.lastName) {
      return `${userProfile.firstName[0]}${userProfile.lastName[0]}`;
    }
    if (user.email) return user.email[0].toUpperCase();
    return 'U';
  };
  
  const fullName = userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : user.email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-3 rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-all hover:bg-muted p-1 md:pr-3 text-left" id="usermenu-button-1-1">
            <Avatar className="h-8 w-8 border shadow-sm">
                <AvatarImage src={userProfile?.photoURL || user.photoURL || ''} alt={fullName || ''} />
                <AvatarFallback>{getInitials()}</AvatarFallback>
            </Avatar>
            <div className="hidden text-left text-xs md:block">
                <p className="font-bold leading-none">{fullName}</p>
                {userProfile?.role && (
                    <p className="mt-1 text-[10px] font-semibold uppercase text-primary/70">{userProfile.role}</p>
                )}
            </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{fullName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Cerrar Sesión</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
