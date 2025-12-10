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
import { Dispatch } from 'react';
import { BackstageEntity } from '../types';
import {
  QueryObserverResult,
  RefetchOptions,
  useQuery,
} from '@tanstack/react-query';
import { pagerDutyApiRef } from '../../api';
import { useApi } from '@backstage/core-plugin-api';
import { PagerDutyEnhancedEntityMappingsResponse } from '@pagerduty/backstage-plugin-common';

interface MappingsDialogProps {
  isOpen: boolean;
  setIsOpen: Dispatch<React.SetStateAction<boolean>>;
  entity: BackstageEntity | null;
  refetchMappings: (
    options?: RefetchOptions,
  ) => Promise<
    QueryObserverResult<PagerDutyEnhancedEntityMappingsResponse, Error>
  >;
}

export default function MappingsDialog({
  isOpen,
  setIsOpen,
  entity,
}: MappingsDialogProps) {
  const pagerDutyApi = useApi(pagerDutyApiRef);
  const { data: services, isLoading: isServicesLoading } = useQuery({
    queryKey: ['pagerduty', 'getAllServices'],
    queryFn: () => pagerDutyApi.getAllServices(),
  });
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
          isDisabled={isServicesLoading}
          label="PagerDuty service"
          placeholder={
            isServicesLoading
              ? 'PagerDuty services loading...'
              : 'Select a PagerDuty service'
          }
          options={serviceOptions}
        />
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" slot="close">
          Cancel
        </Button>
        <Button variant="primary" slot="close">
          Save
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
