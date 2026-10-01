import { createContext, useContext, ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { convex, api } from "@/integrations/convex/client";
import { useAuth } from "@/contexts/AuthContext";

interface Group {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
}

interface GroupMember {
  id: string;
  group_id: string;
  player_id: string;
  role: "admin" | "member";
  joined_at: string;
}

interface GroupContextType {
  groupId: string | undefined;
  group: Group | null;
  members: GroupMember[];
  isLoading: boolean;
  isAdmin: boolean;
  isMember: boolean;
}

const GroupContext = createContext<GroupContextType | undefined>(undefined);

export function GroupProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { groupId } = useParams<{ groupId: string }>();

  const { data: group, isLoading: groupLoading } = useQuery({
    queryKey: ["group", groupId],
    queryFn: async () => {
      if (!groupId) return null;
      return convex.query(api.data.group, { groupId });
    },
    enabled: !!groupId,
  });

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ["group-members", groupId],
    queryFn: async () => {
      if (!groupId) return [];
      return convex.query(api.data.members, { groupId });
    },
    enabled: !!groupId,
  });

  const { data: currentMembership } = useQuery({
    queryKey: ['current-membership', groupId, user?.id],
    queryFn: () => convex.query(api.data.currentMembership, { groupId: groupId! }),
    enabled: !!groupId && !!user,
  });
  const isAdmin = currentMembership?.role === 'admin';
  const isMember = !!currentMembership;

  return (
    <GroupContext.Provider
      value={{
        groupId,
        group: group || null,
        members,
        isLoading: groupLoading || membersLoading,
        isAdmin,
        isMember,
      }}
    >
      {children}
    </GroupContext.Provider>
  );
}

export function useGroup() {
  const context = useContext(GroupContext);
  if (context === undefined) {
    throw new Error("useGroup must be used within a GroupProvider");
  }
  return context;
}
