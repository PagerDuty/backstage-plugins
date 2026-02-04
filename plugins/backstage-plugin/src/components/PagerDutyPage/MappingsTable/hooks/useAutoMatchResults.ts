import { useState } from 'react';

export interface AutoMatchResult {
  score: number;
  serviceId: string;
  account: string;
  serviceName: string;
}

export type AutoMatchResults = Record<string, AutoMatchResult>;

export function useAutoMatchResults() {
  const [autoMatchResults, setAutoMatchResults] = useState<AutoMatchResults>(
    {},
  );

  const hasMatches = Object.keys(autoMatchResults).length > 0;

  const clearMatches = () => {
    setAutoMatchResults({});
  };

  const setMatches = (results: AutoMatchResults) => {
    setAutoMatchResults(results);
  };

  return {
    autoMatchResults,
    hasMatches,
    setMatches,
    clearMatches,
  };
}
