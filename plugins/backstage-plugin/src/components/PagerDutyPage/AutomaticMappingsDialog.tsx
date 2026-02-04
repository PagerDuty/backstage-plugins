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
import { Dispatch, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { pagerDutyApiRef } from '../../api';
import { Warning } from '@mui/icons-material';

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
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedThreshold, setSelectedThreshold] = useState<string>('');

  const { data: groups, isLoading: isGroupsLoading } = useQuery({
    queryKey: ['catalog', 'groups'],
    queryFn: async () => {
      const response = await catalogApi.getEntities({
        filter: {
          kind: 'Group',
        },
      });
      return response.items;
    },
    enabled: isOpen,
  });

  const { mutateAsync: autoMatch, isPending: isAutoMatching } = useMutation({
    mutationFn: async (params: { team?: string; threshold: number }) =>
      pagerDutyApi.autoMatchEntityMappings(params),
    onSuccess: data => {
      const matchMap: Record<
        string,
        {
          score: number;
          serviceId: string;
          account: string;
          serviceName: string;
        }
      > = {};

      const matches = data?.matches;

      if (Array.isArray(matches)) {
        matches.forEach(match => {
          const entityName = match.backstageComponent?.name;
          const score = match.score;

          const serviceId = match.pagerDutyService?.serviceId;
          const serviceName = match.pagerDutyService?.name;

          if (entityName && score !== undefined && serviceId) {
            matchMap[entityName] = {
              score,
              serviceId,
              account: '',
              serviceName,
            };
          }
        });
      }
      onAutoMatchComplete(matchMap);
      queryClient.invalidateQueries({
        queryKey: ['pagerduty', 'enhancedEntityMappings'],
      });
      setIsOpen(false);
    },
  });

  const teamOptions = [
    { value: 'all', label: 'All Teams' },
    ...(groups?.map(group => ({
      value: group.metadata.name,
      label: group.metadata.name,
    })) || []),
  ];

  const thresholdOptions = [
    { value: '100', label: '100%' },
    { value: '90', label: '>= 90%' },
    { value: '80', label: '>= 80%' },
  ];

  const handleBegin = async () => {
    if (!selectedThreshold) return;

    await autoMatch({
      team: selectedTeam,
      threshold: parseInt(selectedThreshold, 10),
    });
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
      <DialogHeader>Service Auto-Mapping</DialogHeader>
      <DialogBody>
        <Box
          style={{
            backgroundColor: '#FEF3CD',
            border: '1px solid #F4C430',
            borderRadius: '4px',
            padding: '16px',
            marginBottom: '24px',
          }}
        >
          <Flex gap="2" align="start">
            <Warning style={{ color: '#F4C430', fontSize: '20px' }} />
            <Box>
              <Text variant="body-medium" weight="bold">
                Disclaimer:
              </Text>
              <Text variant="body-medium">
                Service auto-mapping uses service and team names to match
                components. Please review and confirm any mappings with
                confidence scores below 100% before syncing.
              </Text>
            </Box>
          </Flex>
        </Box>

        <Text variant="body-medium" style={{ marginBottom: '24px' }}>
          This feature will map unmapped Backstage components to PagerDuty
          services and provide a confidence score for each match.
        </Text>

        <Flex direction="column" gap="4">
          <Select
            name="team"
            isDisabled={isGroupsLoading || isAutoMatching}
            label="Backstage Team (optional)"
            placeholder={isGroupsLoading ? 'Loading teams...' : 'Select a team'}
            options={teamOptions}
            value={selectedTeam}
            onChange={value => setSelectedTeam(value as string)}
          />

          <Box>
            <Select
              name="threshold"
              label="Confidence Threshold"
              placeholder="Select Confidence Threshold"
              options={thresholdOptions}
              value={selectedThreshold}
              onChange={value => setSelectedThreshold(value as string)}
              isRequired
              isDisabled={isAutoMatching}
            />
            <Text
              variant="body-small"
              style={{ marginTop: '8px', color: '#666' }}
            >
              Only mappings at or above this threshold will sync automatically
            </Text>
          </Box>
        </Flex>
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
