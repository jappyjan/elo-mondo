import { createContext, useContext, ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  const { groupId } = useParams<{ groupId: string }>();

  const { data: group, isLoading: groupLoading } = useQuery({
    queryKey: ["group", groupId],
    queryFn: async () => {
      if (!groupId) return null;
      const { data, error } = await supabase.from("groups").select("*").eq("id", groupId).single();
      if (error) throw error;
      return data as Group;
    },
    enabled: !!groupId,
  });

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ["group-members", groupId],
    queryFn: async () => {
      if (!groupId) return [];
      const { data, error } = await supabase.from("group_members").select("*").eq("group_id", groupId);
      if (error) throw error;
      return data as GroupMember[];
    },
    enabled: !!groupId,
  });

  // For now, isAdmin and isMember will be determined client-side
  // In a real app, you'd check against the current user's player_id
  const isAdmin = false; // Will be updated when we integrate with auth
  const isMember = false;

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
