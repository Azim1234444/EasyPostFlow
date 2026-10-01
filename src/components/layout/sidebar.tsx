'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  FileVideo, 
  Calendar, 
  Link as LinkIcon, 
  BarChart3, 
  Settings,
  LogOut,
} from 'lucide-react';
import { signOut } from '@/lib/auth/actions';
import { cn } from "cn";
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

interface UserProps {
  email?: string;
  full_name?: string;
}

interface SidebarProps {
  user: UserProps;
  isMobile?: boolean;
  onClose?: () => void;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Content', href: '/content', icon: FileVideo },
  { name: 'Calendar', href: '/calendar', icon: Calendar },
  { name: 'Accounts', href: '/accounts', icon: LinkIcon },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar({ user, isMobile, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className="flex h-full flex-col bg-slate-900 text-white">
      <div className="flex h-16 shrink-0 items-center px-6 bg-slate-950">
        <Link 
          href="/dashboard" 
          className="flex items-center gap-2 text-xl font-bold tracking-tight text-white transition-opacity hover:opacity-90"
          onClick={() => {
            if (isMobile && onClose) onClose();
          }}
        >
          <div className="rounded-md bg-blue-600 p-1">
            <LayoutDashboard className="h-5 w-5 text-white" />
          </div>
          PostFlow
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <nav className="flex flex-col gap-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => {
                  if (isMobile && onClose) onClose();
                }}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-blue-600 text-white" 
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
              >
                <item.icon 
                  className={cn(
                    "h-5 w-5 shrink-0 transition-colors", 
                    isActive ? "text-white" : "text-slate-400 group-hover:text-white"
                  )} 
                  aria-hidden="true" 
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="bg-slate-950 p-4">
        <div className="mb-4 flex items-center gap-3 px-2">
          <Avatar className="h-9 w-9 border border-slate-700 bg-slate-800">
            <AvatarFallback className="bg-slate-800 text-slate-300">
              {getInitials(user?.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            {user?.full_name && (
              <span className="truncate text-sm font-medium text-white">
                {user.full_name}
              </span>
            )}
            <span className="truncate text-xs text-slate-400">
              {user?.email || 'User'}
            </span>
          </div>
        </div>
        
        <Separator className="mb-4 bg-slate-800" />
        
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-slate-400 hover:bg-slate-800 hover:text-white"
          onClick={handleSignOut}
          disabled={isSigningOut}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {isSigningOut ? 'Signing out...' : 'Sign out'}
        </Button>
      </div>
    </div>
  );
}
