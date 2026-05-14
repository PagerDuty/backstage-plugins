import {
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
  Button,
  Select,
  Flex,
  Text,
  Box,
} from '@backstage/ui';
import { Dispatch, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AutoMatchEntityMappingsResponse } from '@pagerduty/backstage-plugin-common';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { pagerDutyApiRef } from '../../api';
import { Warning } from '@mui/icons-material';
import { useAccountContext } from './AccountContext';

interface AutomaticMappingsDialogProps {
  isOpen: boolean;
  setIsOpen: Dispatch<React.SetStateAction<boolean>>;
  onAutoMatchComplete: (
    results: Record<
      string,
      {
        score: number;
        serviceId: string;
        account: string;
        serviceName: string;
        entity?: {
          name: string;
          entityRef: string;
          owner: string;
        };
      }
    >,
  ) => void;
}

export default function AutomaticMappingsDialog({
  isOpen,
  setIsOpen,
  onAutoMatchComplete,
}: AutomaticMappingsDialogProps) {
  const catalogApi = useApi(catalogApiRef);
  const pagerDutyApi = useApi(pagerDutyApiRef);
  const queryClient = useQueryClient();
  const { selectedAccount } = useAccountContext();
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedThreshold, setSelectedThreshold] = useState<string>('');
  const [activeJobId, setActiveJobId] = useState<string | undefined>();

  const { data: groups, isLoading: isGroupsLoading } = useQuery({
    queryKey: ['catalog', 'groups'],
    queryFn: async () => {
      const response = await catalogApi.getEntities({
        filter: {
          kind: 'Group',
        },
        order: [{ field: 'metadata.name', order: 'asc' }],
      });
      return response.items;
    },
    enabled: isOpen,
  });

  const handleAutoMatchResult = (data: AutoMatchEntityMappingsResponse) => {
    const matchMap: Record<
      string,
      {
        score: number;
        serviceId: string;
        account: string;
        serviceName: string;
        entity?: {
          name: string;
          entityRef: string;
          owner: string;
        };
      }
    > = {};

    const matches = data?.matches;

    if (Array.isArray(matches)) {
      matches.forEach(match => {
        const entityName = match.backstageComponent?.name;
        const score = match.score;

        const serviceId = match.pagerDutyService?.serviceId;
        const serviceName = match.pagerDutyService?.name;
        const account = match.pagerDutyService?.account || '';
        const entityRef = match.backstageComponent?.entityRef;
        const owner = match.backstageComponent?.owner;

        if (entityName && score !== undefined && serviceId) {
          matchMap[entityName] = {
            score,
            serviceId,
            account,
            serviceName,
            entity: {
              name: entityName,
              entityRef: entityRef || '',
              owner: owner || '',
            },
          };
        }
      });
    }
    onAutoMatchComplete(matchMap);
    queryClient.invalidateQueries({
      queryKey: ['pagerduty', 'enhancedEntityMappings'],
    });
    setActiveJobId(undefined);
    setIsOpen(false);
  };

  const { mutateAsync: startAutoMatch, isPending: isStartingAutoMatch } =
    useMutation({
      mutationFn: async (params: {
        team?: string;
        threshold: number;
        account?: string;
      }) => pagerDutyApi.startAutoMatchEntityMappings(params),
      onSuccess: data => {
        setActiveJobId(data.jobId);
      },
    });

  const { data: jobStatus, error: jobStatusError } = useQuery({
    queryKey: ['pagerduty', 'autoMatchJob', activeJobId],
    queryFn: () => pagerDutyApi.getAutoMatchStatus(activeJobId!),
    enabled: Boolean(activeJobId),
    refetchInterval: query => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'failed') {
        return false;
      }
      return 5000;
    },
    refetchIntervalInBackground: true,
  });


  if (jobStatus?.status === 'completed' && jobStatus.result) {
    handleAutoMatchResult(jobStatus.result);
  }

  const isAutoMatching =
    isStartingAutoMatch ||
    (Boolean(activeJobId) &&
      jobStatus?.status !== 'completed' &&
      jobStatus?.status !== 'failed');

  const teamOptions = [
    { value: 'all', label: 'All Teams' },
    ...(groups?.map(group => ({
      value: group.metadata.name,
      label: group.metadata.name,
    })) || []),
  ];

  const thresholdOptions = [
    { value: '100', label: 'Exact Match (100%)' },
    { value: '90', label: 'High Confidence (>= 90%)' },
    { value: '80', label: 'Medium Confidence (>= 80%)' },
  ];

  const handleBegin = async () => {
    if (!selectedThreshold) return;

    await startAutoMatch({
      team: selectedTeam === 'all' ? undefined : selectedTeam,
      threshold: parseInt(selectedThreshold, 10),
      account: selectedAccount,
    });
  };

  let failureMessage: string | undefined;
  if (jobStatus?.status === 'failed') {
    failureMessage = jobStatus.error || 'Auto-match failed';
  } else if (jobStatusError instanceof Error) {
    failureMessage = jobStatusError.message;
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={setIsOpen} style={{ width: '460px' }}>
      <DialogHeader>Service Auto-Mapping</DialogHeader>
      <DialogBody>
        <Box p="0 24px 8px 24px">
          <Box
            style={{
              backgroundColor: '#FEF3CD',
              border: '1px solid #F4C430',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '8px',
            }}
          >
            <Flex gap="2" align="start" direction="column">
              <Flex gap="1">
                <Warning
                  style={{
                    color: '#F4C430',
                    fontSize: 'var(--bui-font-size-3)',
                  }}
                />
                <Text
                  variant="body-medium"
                  weight="bold"
                  style={{ color: '#D97706', marginLeft: '4px' }}
                >
                  Disclaimer:
                </Text>
              </Flex>

              <Text variant="body-medium" style={{ color: '#6B7280' }}>
                Service auto-mapping uses service and team names to match
                components. Please review and confirm any mappings with
                confidence scores below 100% before syncing.
              </Text>
            </Flex>
          </Box>

          <Text
            variant="body-medium"
            style={{
              marginBottom: '16px',
              display: 'block',
              lineHeight: '1.6',
            }}
          >
            This feature will map unmapped Backstage components to PagerDuty
            services and provide a confidence score for each match.
          </Text>

          <Flex direction="column" gap="5">
            <Select
              name="team"
              isDisabled={isGroupsLoading || isAutoMatching}
              label="Backstage Team (optional)"
              placeholder={
                isGroupsLoading ? 'Loading teams...' : 'Select a team'
              }
              options={teamOptions}
              value={selectedTeam}
              onChange={value => setSelectedTeam(value as string)}
              searchable
              searchPlaceholder='Search teams...'
            />

            <Box>
              <Flex direction="column" style={{ marginBottom: '8px' }} gap="0">
                <Text variant="body-small">Confidence Threshold *</Text>
                <Text
                  variant="body-x-small"
                  style={{
                    color: '#6B7280',
                  }}
                >
                  Only mappings at or above this threshold will sync
                  automatically
                </Text>
              </Flex>
              <Select
                name="threshold"
                placeholder="Select Confidence Threshold"
                options={thresholdOptions}
                value={selectedThreshold}
                onChange={value => setSelectedThreshold(value as string)}
                isDisabled={isAutoMatching}
              />
            </Box>
            {isAutoMatching && (
              <Text variant="body-small" style={{ color: '#6B7280' }}>
                Running auto-match in the background. This may take a few
                minutes for large amounts of PagerDuty services.
              </Text>
            )}
            {failureMessage && (
              <Text variant="body-small" style={{ color: '#B91C1C' }}>
                {failureMessage}
              </Text>
            )}
          </Flex>
        </Box>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" slot="close">
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleBegin}
          isDisabled={!selectedThreshold || isAutoMatching}
        >
          {isAutoMatching ? 'Processing...' : 'Begin'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
