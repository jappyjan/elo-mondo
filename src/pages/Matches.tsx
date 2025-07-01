
import { AddPlayerForm } from '@/components/AddPlayerForm';
import { RecordMatchForm } from '@/components/RecordMatchForm';
import { RecordMultiPlayerMatchForm } from '@/components/RecordMultiPlayerMatchForm';
import { RecentMatches } from '@/components/RecentMatches';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Target } from 'lucide-react';

const Matches = () => {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Matches</h1>
        <p className="text-muted-foreground">
          Record new matches and view match history
        </p>
      </div>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Add Player Form */}
        <AddPlayerForm />

        {/* Match Recording Forms */}
        <Tabs defaultValue="1v1" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="1v1">1v1 Match</TabsTrigger>
            <TabsTrigger value="multiplayer">Multi-Player</TabsTrigger>
          </TabsList>
          <TabsContent value="1v1">
            <RecordMatchForm />
          </TabsContent>
          <TabsContent value="multiplayer">
            <RecordMultiPlayerMatchForm />
          </TabsContent>
        </Tabs>

        {/* Recent Matches */}
        <RecentMatches />
      </div>
    </div>
  );
};

export default Matches;
