import {
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
  Button,
  Select,
  Flex,
  Text,
} from '@backstage/ui';
import { Dispatch, useState } from 'react';
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

  const { data: services, isLoading: isServicesLoading } = useQuery({
    queryKey: ['pagerduty', 'getAllServices'],
    queryFn: () => pagerDutyApi.getAllServices(),
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

  const serviceOptions = services?.map(service => ({
    value: service.id,
    label: service.name,
  }));

  return (
    <Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
      <DialogHeader>Update Entity Mapping</DialogHeader>
      <DialogBody>
        <Flex>
          <Text variant="body-medium" weight="regular">
            Name:
          </Text>
          <Text variant="body-medium" weight="bold">
            {entity?.name}
          </Text>
        </Flex>

        <Flex mb="3">
          <Text variant="body-medium" weight="regular">
            Team:
          </Text>
          <Text variant="body-medium" weight="bold">
            {entity?.owner}
          </Text>
        </Flex>

        <Select
          name="service"
          isDisabled={isServicesLoading || isCreatingMapping}
          label="PagerDuty service"
          placeholder={
            isServicesLoading
              ? 'PagerDuty services loading...'
              : 'Select a PagerDuty service'
          }
          options={serviceOptions}
          value={selectedServiceId}
          onChange={value => setSelectedServiceId(value as string)}
        />
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
