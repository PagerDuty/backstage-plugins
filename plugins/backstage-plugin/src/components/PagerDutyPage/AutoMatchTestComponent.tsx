/**
 * TEMPORARY TEST COMPONENT
 *
 * This component is for testing the auto-match endpoint with real data.
 * Remove this file and the tab from index.tsx before merging to main.
 */

import { useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Grid,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { useApi, discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';

interface MatchResult {
  pagerDutyService: {
    serviceId: string;
    name: string;
    team: string;
  };
  backstageComponent: {
    entityRef: string;
    name: string;
    owner: string;
  };
  score: number;
  confidence: 'exact' | 'high' | 'medium' | 'low';
  scoreBreakdown: {
    baseScore: number;
    exactMatch: boolean;
    teamMatch: boolean;
    acronymMatch: boolean;
    rawScore: number;
  };
}

interface AutoMatchResponse {
  matches: MatchResult[];
  statistics: {
    totalPagerDutyServices: number;
    totalBackstageComponents: number;
    totalPossibleComparisons: number;
    matchesFound: number;
    exactMatches: number;
    highConfidenceMatches: number;
    mediumConfidenceMatches: number;
    threshold: number;
    loadTimeMs: number;
    matchTimeMs: number;
    totalTimeMs: number;
  };
}

export const AutoMatchTestComponent = () => {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const [threshold, setThreshold] = useState(90);
  const [bestOnly, setBestOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AutoMatchResponse | null>(null);

  const handleTest = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const baseUrl = await discoveryApi.getBaseUrl('pagerduty');
      const url = `${baseUrl}/mapping/entity/auto-match`;

      const response = await fetchApi.fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          threshold,
          bestOnly,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || errorData.message || `HTTP ${response.status}`,
        );
      }

      const data: AutoMatchResponse = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'exact':
        return 'primary';
      case 'high':
        return 'secondary';
      case 'medium':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <Box p={3}>
      <Alert severity="warning" style={{ marginBottom: 20 }}>
        <Typography variant="body2">
          <b>TEMPORARY TEST PAGE</b> - This is for testing the auto-match
          backend endpoint. Remove before final merge.
        </Typography>
      </Alert>

      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Auto-Match Test
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            Test the auto-matching algorithm with real PagerDuty and Backstage
            data
          </Typography>

          <Grid container spacing={3} style={{ marginTop: 10 }}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Threshold</InputLabel>
                <Select
                  value={threshold}
                  onChange={e => setThreshold(e.target.value as number)}
                >
                  <MenuItem value={100}>100% (Exact matches only)</MenuItem>
                  <MenuItem value={95}>95% (Very high confidence)</MenuItem>
                  <MenuItem value={90}>90% (High confidence)</MenuItem>
                  <MenuItem value={85}>85% (Good matches)</MenuItem>
                  <MenuItem value={80}>80% (Medium confidence)</MenuItem>
                  <MenuItem value={75}>75% (Lower threshold)</MenuItem>
                  <MenuItem value={70}>70% (Show more matches)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Mode</InputLabel>
                <Select
                  value={bestOnly ? 'best' : 'all'}
                  onChange={e => setBestOnly(e.target.value === 'best')}
                >
                  <MenuItem value="all">All matches</MenuItem>
                  <MenuItem value="best">Best match per service</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleTest}
                disabled={loading}
                fullWidth
                size="large"
                style={{ height: 56 }}
              >
                {loading ? <CircularProgress size={24} /> : 'Run Auto-Match'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" style={{ marginTop: 20 }}>
          <Typography variant="h6">Error</Typography>
          <Typography variant="body2">{error}</Typography>
        </Alert>
      )}

      {result && (
        <>
          <Card style={{ marginTop: 20 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Statistics
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6} md={3}>
                  <Typography variant="body2" color="textSecondary">
                    PagerDuty Services
                  </Typography>
                  <Typography variant="h4">
                    {result.statistics.totalPagerDutyServices}
                  </Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="body2" color="textSecondary">
                    Backstage Components
                  </Typography>
                  <Typography variant="h4">
                    {result.statistics.totalBackstageComponents}
                  </Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="body2" color="textSecondary">
                    Matches Found
                  </Typography>
                  <Typography variant="h4">
                    {result.statistics.matchesFound}
                  </Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="body2" color="textSecondary">
                    Total Time
                  </Typography>
                  <Typography variant="h4">
                    {result.statistics.totalTimeMs}ms
                  </Typography>
                </Grid>

                <Grid item xs={4}>
                  <Typography variant="body2" color="textSecondary">
                    Exact Matches (100%)
                  </Typography>
                  <Typography variant="h6">
                    {result.statistics.exactMatches}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="textSecondary">
                    High Confidence (90-99%)
                  </Typography>
                  <Typography variant="h6">
                    {result.statistics.highConfidenceMatches}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="textSecondary">
                    Medium Confidence (80-89%)
                  </Typography>
                  <Typography variant="h6">
                    {result.statistics.mediumConfidenceMatches}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card style={{ marginTop: 20 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Top Matches (showing first 20)
              </Typography>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Score</TableCell>
                      <TableCell>PagerDuty Service</TableCell>
                      <TableCell>Backstage Component</TableCell>
                      <TableCell>Team</TableCell>
                      <TableCell>Bonuses</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.matches.slice(0, 20).map((match, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Chip
                            label={`${match.score}%`}
                            color={getConfidenceColor(match.confidence)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {match.pagerDutyService.name}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="textSecondary"
                          >
                            {match.pagerDutyService.team || '(no team)'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {match.backstageComponent.name}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="textSecondary"
                          >
                            {match.backstageComponent.owner || '(no owner)'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {match.scoreBreakdown.teamMatch ? '✅' : '❌'}
                        </TableCell>
                        <TableCell>
                          <Box>
                            {match.scoreBreakdown.exactMatch && (
                              <Chip
                                label="Exact"
                                size="small"
                                style={{ marginRight: 4 }}
                              />
                            )}
                            {match.scoreBreakdown.teamMatch && (
                              <Chip
                                label="+10% Team"
                                size="small"
                                style={{ marginRight: 4 }}
                              />
                            )}
                            {match.scoreBreakdown.acronymMatch && (
                              <Chip label="+5% Acronym" size="small" />
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {result.matches.length > 20 && (
                <Typography
                  variant="caption"
                  color="textSecondary"
                  style={{ marginTop: 10, display: 'block' }}
                >
                  Showing 20 of {result.matches.length} matches
                </Typography>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
};
