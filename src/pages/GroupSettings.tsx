import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { convex, api } from '@/integrations/convex/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Loader2, Check, Crown, User } from 'lucide-react';
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
  const [copiedCode, setCopiedCode] = useState(false);

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
                      <span>{member.player?.name ?? 'Player'}</span>
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
