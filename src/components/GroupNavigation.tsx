import { Link, useLocation, useParams, useNavigate } from 'react-router-dom';
import { Target, Trophy, Zap, Crosshair, BarChart3, Settings, LogOut, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function GroupNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { groupId } = useParams<{ groupId: string }>();
  const { user, signOut } = useAuth();

  // Fetch group info
  const { data: group } = useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => {
      if (!groupId) return null;
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!groupId,
  });

  const navItems = [
    { path: `/${groupId}`, label: 'Dashboard', icon: Trophy },
    { path: `/${groupId}/matches`, label: 'Matches', icon: Zap },
    { path: `/${groupId}/live`, label: 'Live Game', icon: Crosshair },
    { path: `/${groupId}/analytics`, label: 'Analytics', icon: BarChart3 },
  ];

  const isActive = (path: string) => {
    if (path === `/${groupId}`) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link to="/groups" className="flex items-center gap-2 font-bold text-xl">
              <Target className="h-8 w-8 text-primary" />
              <span className="hidden sm:inline">EloMondo</span>
            </Link>
            
            {group && (
              <>
                <span className="text-muted-foreground">/</span>
                <span className="font-medium truncate max-w-[150px]">{group.name}</span>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      active 
                        ? "bg-primary text-primary-foreground" 
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="ml-2">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to="/groups" className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      My Groups
                    </Link>
                  </DropdownMenuItem>
                  {groupId && (
                    <DropdownMenuItem asChild>
                      <Link to={`/${groupId}/settings`} className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Group Settings
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={async () => {
                    await signOut();
                    navigate('/');
                  }} className="text-destructive">
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
