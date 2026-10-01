import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { convex, api } from '@/integrations/convex/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Copy, UserPlus, Loader2, Check, Crown, User } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface GroupMemberWithPlayer {
  id: string;
  role: 'admin' | 'member';
  joined_at: string;
  player: {
    id: string;
    name: string;
  };
}

interface GroupMemberRow {
  id: string;
  role: 'admin' | 'member';
  joined_at: string;
  players: {
    id: string;
    name: string;
  };
}

export default function GroupSettings() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  // Fetch group info
  const { data: group } = useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => {
      if (!groupId) return null;
      return convex.query(api.data.group, { groupId });
    },
    enabled: !!groupId,
  });

  // Fetch invite code (separate table with restricted access)
  const { data: inviteCodeData } = useQuery({
    queryKey: ['group-invite-code', groupId],
    queryFn: async () => {
      if (!groupId) return null;
      return convex.query(api.data.inviteCode, { groupId });
    },
    enabled: !!groupId,
  });

  // Fetch group members with player info
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['group-members-full', groupId],
    queryFn: async () => {
      if (!groupId) return [];
      return convex.query(api.data.members, { groupId });
    },
    enabled: !!groupId,
  });

  // Check if current user is admin
  const { data: currentMembership } = useQuery({
    queryKey: ['current-membership', groupId, user?.id],
    queryFn: async () => {
      if (!groupId || !user) return null;
      
      return convex.query(api.data.currentMembership, { groupId });
    },
    enabled: !!groupId && !!user,
  });

  const isAdmin = currentMembership?.role === 'admin';

  // Send email invite mutation
  const sendInvite = useMutation({
    mutationFn: async (email: string) => {
      return convex.mutation(api.data.createInvite, { groupId: groupId!, email });
    },
    onSuccess: () => {
      toast({ title: 'Invite Sent', description: 'Email invitation has been created' });
      setInviteEmail('');
      setInviteDialogOpen(false);
    },
    onError: (error: Error) => {
      const message = error.message.includes('duplicate') 
        ? 'This email has already been invited'
        : error.message;
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  });

  const copyInviteCode = () => {
    if (inviteCodeData?.invite_code) {
      navigator.clipboard.writeText(inviteCodeData.invite_code);
      setCopiedCode(true);
      toast({ title: 'Copied!', description: 'Invite code copied to clipboard' });
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  if (!group) {
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{group.name}</h1>
        <p className="text-muted-foreground">Group settings and members</p>
      </div>

      <div className="space-y-6">
        {/* Invite Code Card - Only show if admin has access */}
        {inviteCodeData?.invite_code && (
          <Card>
            <CardHeader>
              <CardTitle>Invite Code</CardTitle>
              <CardDescription>Share this code with others to let them join the group</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-4 py-2 rounded text-lg font-mono">
                  {inviteCodeData.invite_code}
                </code>
                <Button onClick={copyInviteCode} variant="outline" size="icon">
                  {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Email Invite Card (Admin only) */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Email Invitations</CardTitle>
              <CardDescription>Send email invitations to specific people</CardDescription>
            </CardHeader>
            <CardContent>
              <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" /> Invite by Email
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Send Email Invite</DialogTitle>
                    <DialogDescription>
                      The recipient will receive an invitation to join {group.name}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); sendInvite.mutate(inviteEmail); }} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="invite-email">Email Address</Label>
                      <Input
                        id="invite-email"
                        type="email"
                        placeholder="friend@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={sendInvite.isPending}>
                      {sendInvite.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Send Invitation
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        )}

        {/* Members Card */}
        <Card>
          <CardHeader>
            <CardTitle>Members ({members.length})</CardTitle>
            <CardDescription>Players in this group</CardDescription>
          </CardHeader>
          <CardContent>
            {membersLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50">
                    <div className="flex items-center gap-3">
                      {member.role === 'admin' ? (
                        <Crown className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <User className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>{member.player.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground capitalize">{member.role}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
