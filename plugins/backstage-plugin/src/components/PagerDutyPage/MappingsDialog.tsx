import {
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
  Button,
  Select,
  Flex,
  Text,
  SearchField,
  ToggleButtonGroup,
  ToggleButton,
  Box,
  TextField,
} from '@backstage/ui';
import { Dispatch, useState, useEffect } from 'react';
import { BackstageEntity } from '../types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pagerDutyApiRef } from '../../api';
import { useApi } from '@backstage/core-plugin-api';

interface MappingsDialogProps {
  isOpen: boolean;
  setIsOpen: Dispatch<React.SetStateAction<boolean>>;
  entity: BackstageEntity | null;
}

export default function MappingsDialog({
  isOpen,
  setIsOpen,
  entity,
}: MappingsDialogProps) {
  const pagerDutyApi = useApi(pagerDutyApiRef);
  const queryClient = useQueryClient();
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');

  // Debounce search query (wait 500ms after user stops typing)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Clean up state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedServiceId('');
      setSelectedTeamIds([]);
      setSearchQuery('');
      setDebouncedSearchQuery('');
    }
  }, [isOpen]);

  // Fetch all teams
  const { data: teams, isLoading: isTeamsLoading } = useQuery({
    queryKey: ['pagerduty', 'getAllTeams'],
    queryFn: () => pagerDutyApi.getAllTeams(),
    enabled: isOpen,
  });

  // Fetch filtered services based on selected teams and search query
  const { data: services, isLoading: isServicesLoading } = useQuery({
    queryKey: ['pagerduty', 'getFilteredServices', selectedTeamIds, debouncedSearchQuery],
    queryFn: async () => {
      const teamIdsToSend = selectedTeamIds.length > 0 ? selectedTeamIds : undefined;
      const queryToSend = debouncedSearchQuery || undefined;
      const result = await pagerDutyApi.getFilteredServices(
        teamIdsToSend,
        queryToSend,
        10,
      );
      return result;
    },
    enabled: isOpen,
  });

  const { mutateAsync: createMapping, isPending: isCreatingMapping } =
    useMutation({
      mutationFn: async ({
        serviceId,
        integrationKey,
        entityRef,
        account,
      }: {
        serviceId: string;
        integrationKey: string;
        entityRef: string;
        account: string;
      }) =>
        pagerDutyApi.storeServiceMapping(
          serviceId,
          integrationKey,
          entityRef,
          account,
        ),

      onSuccess: async () => {
        queryClient.invalidateQueries({
          queryKey: ['pagerduty', 'enhancedEntityMappings'],
        });
        setIsOpen(false);
        setSelectedServiceId('');
      },
    });

  const handleSaveMapping = () => {
    if (!entity || !selectedServiceId) return;

    if (selectedServiceId === 'none') {
      const currentServiceId = entity.annotations?.['pagerduty.com/service-id'];
      const currentIntegrationKey = entity.annotations?.['pagerduty.com/integration-key'] || '';
      const account = entity.account || '';

      if (!currentServiceId) return;

      createMapping({
        serviceId: currentServiceId,
        integrationKey: currentIntegrationKey,
        entityRef: '',
        account: account,
      });
      return;
    }

    const selectedService = services?.find(
      service => service.id === selectedServiceId,
    );

    if (!selectedService) return;

    const entityRef =
      `${entity.type}:${entity.namespace}/${entity.name}`.toLowerCase();

    createMapping({
      serviceId: selectedServiceId,
      integrationKey: '',
      entityRef: entityRef,
      account: selectedService.account ?? '',
    });
  };

  // Prepare team options for Select
  const teamOptions = [
    { value: '', label: 'All Teams' },
    ...(teams?.map(team => ({
      value: team.id,
      label: team.name,
    })) || []),
  ];

  return (
    <Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
      <DialogHeader>Update Entity Mapping</DialogHeader>
      <DialogBody>
        <style>
          {`
            .toggle-group-container {
              border: 1px solid var(--bui-border);
              border-radius: var(--bui-radius-2);
            }
            .full-width-toggle-group[data-orientation='vertical'] {
              width: 100% !important;
            }
            .full-width-toggle-group button {
              font-weight: normal !important;
            }
            .full-width-toggle-group .bui-ToggleButtonContent {
              justify-content: flex-start !important;
            }
          `}
        </style>
        <Flex direction="column" gap="2" mb="4">
          <Text variant="body-medium" weight="bold">
            Backstage Component
          </Text>
          <TextField
            value={entity?.name || ''}
            isReadOnly
          />
        </Flex>

        <Flex direction="column" gap="2" mb="4">
          <Text variant="body-medium" weight="bold">
            Team
          </Text>
          <TextField
            value={entity?.owner || ''}
            isReadOnly
          />
        </Flex>

        <Box mb="3">
          <Text variant="body-medium" weight="bold">
            Map to Service
          </Text>
        </Box>

        <Box mb="3">
          <Select
            name="team"
            isDisabled={isTeamsLoading || isCreatingMapping}
            label="PagerDuty Team (Optional)"
            placeholder="All Teams"
            options={teamOptions}
            value={selectedTeamIds[0] || ''}
            onChange={value => {
              const teamId = String(value || '');
              setSelectedTeamIds(teamId ? [teamId] : []);
              setSelectedServiceId('');
            }}
          />
        </Box>

        <Flex direction="column" gap="2" mb="3">
          <Text variant="body-medium" weight="bold">
            PagerDuty Services
          </Text>
          <Text variant="body-small">
            Search by service name or service ID
          </Text>
          <SearchField
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search"
          />
        </Flex>

        {isServicesLoading ? (
          <Text>Loading services...</Text>
        ) : (
          <>
            <Box
              mb="2"
              width="100%"
              className="toggle-group-container"
              style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
            >
              <ToggleButtonGroup
                selectionMode="single"
                orientation="vertical"
                className="full-width-toggle-group"
                selectedKeys={selectedServiceId ? [selectedServiceId] : []}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys as Set<string>)[0] || '';
                  setSelectedServiceId(selected);
                }}
              >
                {entity?.annotations?.['pagerduty.com/service-id'] && (
                  <ToggleButton key="none" id="none">
                    (None)
                  </ToggleButton>
                )}
                {services && services.map(service => (
                  <ToggleButton key={service.id} id={service.id}>
                    {service.name}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
            {services && services.length > 0 ? (
              <Text variant="body-small">
                Showing {services.length} result{services.length !== 1 ? 's' : ''}
              </Text>
            ) : (
              <Text variant="body-small">No services found</Text>
            )}
          </>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" slot="close">
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSaveMapping}
          isDisabled={!selectedServiceId || isCreatingMapping}
        >
          {isCreatingMapping ? 'Saving...' : 'Save'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
