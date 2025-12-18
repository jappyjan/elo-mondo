import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Target, Plus, Users, ArrowRight, Loader2, LogOut } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface GroupWithMembership {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
  role: 'admin' | 'member';
}

export default function Groups() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  // Fetch user's groups
  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['user-groups', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Get player for current user
      const { data: player } = await supabase
        .from('players')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (!player) return [];

      // Get memberships with group info
      const { data: memberships, error } = await supabase
        .from('group_members')
        .select(`
          role,
          groups (
            id,
            name,
            invite_code,
            created_at
          )
        `)
        .eq('player_id', player.id);

      if (error) throw error;

      return (memberships || []).map((m: any) => ({
        ...m.groups,
        role: m.role
      })) as GroupWithMembership[];
    },
    enabled: !!user,
  });

  // Create group mutation
  const createGroup = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('groups')
        .insert({ name, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['user-groups'] });
      toast({ title: 'Group Created!', description: `"${data.name}" is ready to go` });
      setCreateDialogOpen(false);
      setNewGroupName('');
      navigate(`/${data.id}`);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Join group mutation
  const joinGroup = useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('join_group_by_code', { _invite_code: code });
      if (error) throw error;
      return data;
    },
    onSuccess: (groupId) => {
      queryClient.invalidateQueries({ queryKey: ['user-groups'] });
      toast({ title: 'Joined Group!', description: 'Welcome to the group' });
      setJoinDialogOpen(false);
      setInviteCode('');
      navigate(`/${groupId}`);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  if (!user) {
    return (
      <div className="container mx-auto py-16 px-4 text-center">
        <Target className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
        <h1 className="text-2xl font-bold mb-2">Login Required</h1>
        <p className="text-muted-foreground mb-4">Please log in to view your groups</p>
        <Link to="/auth">
          <Button>Login</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="flex justify-end mb-4">
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" /> Sign Out
        </Button>
      </div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">My Groups</h1>
          <p className="text-muted-foreground">Your dart leagues and competitions</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">Join Group</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Join a Group</DialogTitle>
                <DialogDescription>Enter the invite code to join an existing group</DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); joinGroup.mutate(inviteCode); }} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-code">Invite Code</Label>
                  <Input
                    id="invite-code"
                    placeholder="e.g. a1b2c3d4"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={joinGroup.isPending}>
                  {joinGroup.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Join Group
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Create Group
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a New Group</DialogTitle>
                <DialogDescription>Start a new dart league or competition</DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createGroup.mutate(newGroupName); }} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="group-name">Group Name</Label>
                  <Input
                    id="group-name"
                    placeholder="e.g. Office Darts League"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createGroup.isPending}>
                  {createGroup.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create Group
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Groups Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create a new group or join an existing one to start tracking your Elo rating
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {groups.map((group) => (
            <Link key={group.id} to={`/${group.id}`}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {group.name}
                      {group.role === 'admin' && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Admin</span>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Joined {new Date(group.created_at).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
