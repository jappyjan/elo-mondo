import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import GroupNavigation from "@/components/GroupNavigation";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Groups from "./pages/Groups";
import Dashboard from "./pages/Dashboard";
import Matches from "./pages/Matches";
import LiveGame from "./pages/LiveGame";
import Analytics from "./pages/Analytics";
import GroupSettings from "./pages/GroupSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Layout component for group pages
function GroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <GroupNavigation />
      {children}
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/groups" element={<Groups />} />
              
              {/* Group-scoped routes */}
              <Route path="/:groupId" element={<GroupLayout><Dashboard /></GroupLayout>} />
              <Route path="/:groupId/matches" element={<GroupLayout><Matches /></GroupLayout>} />
              <Route path="/:groupId/live" element={<GroupLayout><LiveGame /></GroupLayout>} />
              <Route path="/:groupId/analytics" element={<GroupLayout><Analytics /></GroupLayout>} />
              <Route path="/:groupId/settings" element={<GroupLayout><GroupSettings /></GroupLayout>} />
              
              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
