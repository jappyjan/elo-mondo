export type TimeScopeKind = '30d' | '90d' | 'year' | 'all';

export interface AnalyticsTimeScope {
  kind: TimeScopeKind;
  year?: number;
  now?: Date;
}

export interface PlayerIdentity {
  key: string;
  playerId: string | null;
  playerName: string;
}

export interface AnalyticsEloResult {
  playerId: string;
  eloBefore: number;
  eloAfter: number;
  eloChange: number;
}

export interface AnalyticsMatchParticipant extends PlayerIdentity {
  rank: number;
  isWinner: boolean;
}

export interface AnalyticsMatch {
  matchId: string;
  matchDate: string;
  totalPlayers: number;
  participants: AnalyticsMatchParticipant[];
  eloResults: AnalyticsEloResult[];
}

export interface AnalyticsThrow extends PlayerIdentity {
  id: string;
  gameId: string;
  gamePlayerId: string;
  turnNumber: number;
  throwIndex: number;
  segment: number;
  multiplier: number;
  score: number;
  label: string;
  createdAt: string;
}

export interface DartTurn {
  turnKey: string;
  playerKey: string;
  playerId: string | null;
  playerName: string;
  gameId: string;
  gamePlayerId: string;
  turnNumber: number;
  createdAt: string;
  darts: AnalyticsThrow[];
  labels: string[];
  segments: number[];
  totalScore: number;
}

export interface PlayerMatchStats extends PlayerIdentity {
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  averageFinishRank: number;
  totalEloChange: number;
  bestEloGain: number;
  worstEloLoss: number;
  recentForm: string[];
  placements: Array<{ rank: number; count: number }>;
}

export interface HeadToHeadMeeting {
  matchId: string;
  matchDate: string;
  playerRank: number;
  opponentRank: number;
  eloChange: number;
}

export interface PairwiseRecord extends PlayerIdentity {
  opponentKey: string;
  opponentId: string | null;
  opponentName: string;
  wins: number;
  losses: number;
  totalGames: number;
  winRate: number;
  eloChange: number;
  meetings: HeadToHeadMeeting[];
}

export interface PlayerThrowStats extends PlayerIdentity {
  totalDarts: number;
  totalTurns: number;
  averageTurnScore: number;
  averagePointsPerDart: number;
  missCount: number;
  missRate: number;
  singles: number;
  doubles: number;
  triples: number;
  bulls: number;
  t20Count: number;
  oneCount: number;
  count100Plus: number;
  count140Plus: number;
  count180: number;
  bestTurn: number;
  mostCommonSegment: string;
  mostCommonDart: string;
  mostCommonTurnPattern: string;
}

export interface CountStat {
  label: string;
  count: number;
}

export interface RateStat extends CountStat {
  rate: number;
}

export interface FunDartRecords {
  mostOnes: CountStat[];
  mostMisses: CountStat[];
  mostFiveTwentyOne: CountStat[];
  mostTwentySixClub: CountStat[];
  mostNeighborHits: CountStat[];
  mostAllOverBoard: CountStat[];
  mostAlmost180: CountStat[];
  highestSingleRate: RateStat[];
  highestTripleRate: RateStat[];
}

export interface ThrowAnalyticsSummary {
  totalDarts: number;
  totalTurns: number;
  averageTurnScore: number;
  averagePointsPerDart: number;
  exactDarts: CountStat[];
  segments: CountStat[];
  turnPatterns: CountStat[];
  scoreDistribution: CountStat[];
  playerStats: PlayerThrowStats[];
  funRecords: FunDartRecords;
}

export interface LeagueAnalyticsSummary {
  activePlayers: number;
  matchesPlayed: number;
  throwsTracked: number;
  averageTurnScore: number;
  averagePointsPerDart: number;
  mostImproved: PlayerMatchStats | null;
  hottestPlayer: PlayerMatchStats | null;
  mostActive: PlayerMatchStats | null;
  biggestEloGain: { playerName: string; value: number } | null;
}
