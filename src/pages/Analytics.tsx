import { useState, useEffect } from 'react';
import { useCalculatedPlayers } from '@/hooks/usePlayers';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, User, Users, TrendingUp, Loader2 } from 'lucide-react';
import AnalyticsOverview from '@/components/analytics/AnalyticsOverview';
import IndividualPerformance from '@/components/analytics/IndividualPerformance';
import HeadToHead from '@/components/analytics/HeadToHead';
import TrendAnalysis from '@/components/analytics/TrendAnalysis';

const Analytics = () => {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  
  // Fetch initial data to get available years
  const { data: initialData, isLoading: initialLoading } = useCalculatedPlayers(false, null, true);
  
  // Set default year when data loads
  useEffect(() => {
    if (initialData?.availableYears?.length && selectedYear === null) {
      setSelectedYear(initialData.availableYears[0]);
    }
  }, [initialData, selectedYear]);

  // Fetch data for selected year (only when year is set)
  const { data: eloData, isLoading, error } = useCalculatedPlayers(
    false,
    selectedYear,
    true
  );

  const availableYears = initialData?.availableYears || [];

  if (initialLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-destructive">
          Error loading analytics data
        </div>
      </div>
    );
  }

  const players = eloData?.players || [];
  const matchHistory = eloData?.matchHistory || [];

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Deep dive into performance data</p>
        </div>
        
        {/* Year Filter */}
        <Select
          value={selectedYear?.toString() || ''}
          onValueChange={(value) => setSelectedYear(parseInt(value))}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Select year" />
          </SelectTrigger>
          <SelectContent>
            {availableYears.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="h-4 w-4 hidden sm:inline" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="individual" className="gap-2">
            <User className="h-4 w-4 hidden sm:inline" />
            Individual
          </TabsTrigger>
          <TabsTrigger value="h2h" className="gap-2">
            <Users className="h-4 w-4 hidden sm:inline" />
            Head-to-Head
          </TabsTrigger>
          <TabsTrigger value="trends" className="gap-2">
            <TrendingUp className="h-4 w-4 hidden sm:inline" />
            Trends
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <AnalyticsOverview 
            players={players} 
            matchHistory={matchHistory}
            selectedYear={selectedYear}
          />
        </TabsContent>

        <TabsContent value="individual">
          <IndividualPerformance 
            players={players} 
            matchHistory={matchHistory}
          />
        </TabsContent>

        <TabsContent value="h2h">
          <HeadToHead 
            players={players} 
            matchHistory={matchHistory}
          />
        </TabsContent>

        <TabsContent value="trends">
          <TrendAnalysis 
            players={players} 
            matchHistory={matchHistory}
            selectedYear={selectedYear}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Analytics;
