
import { useParams } from 'react-router-dom';
import { AddPlayerForm } from '@/components/AddPlayerForm';
import { RecordMatchForm } from '@/components/RecordMatchForm';
import { RecordMultiPlayerMatchForm } from '@/components/RecordMultiPlayerMatchForm';
import { RecentMatches } from '@/components/RecentMatches';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Matches = () => {
  const { groupId } = useParams<{ groupId: string }>();

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Matches</h1>
        <p className="text-muted-foreground">
          Record new matches and view match history
        </p>
      </div>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Match Recording Forms */}
        <Tabs defaultValue="multiplayer" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="1v1">1v1 Match</TabsTrigger>
            <TabsTrigger value="multiplayer">Multi-Player</TabsTrigger>
          </TabsList>
          <TabsContent value="1v1">
            <RecordMatchForm groupId={groupId} />
          </TabsContent>
          <TabsContent value="multiplayer">
            <RecordMultiPlayerMatchForm groupId={groupId} />
          </TabsContent>
        </Tabs>

        {/* Recent Matches */}
        <RecentMatches groupId={groupId} />
      </div>
    </div>
  );
};

export default Matches;
