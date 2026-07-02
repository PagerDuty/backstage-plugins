import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Flex,
  Text,
} from '@backstage/ui';
import { useApi } from '@backstage/core-plugin-api';
import { BackstageCustomField } from '@pagerduty/backstage-plugin-common';
import { pagerDutyApiRef } from '../../../api';
import { useAccountContext } from '../AccountContext';

interface DeleteCustomFieldDialogProps {
  field: BackstageCustomField | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const DeleteCustomFieldDialog = ({
  field,
  onClose,
  onSuccess,
}: DeleteCustomFieldDialogProps) => {
  const pagerDutyApi = useApi(pagerDutyApiRef);
  const queryClient = useQueryClient();
  const { selectedAccount } = useAccountContext();
  const account = selectedAccount || undefined;

  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleConfirm = async () => {
    if (!field) return;
    setDeleting(true);
    setError(null);
    const result = await pagerDutyApi.deleteCustomField(field.id, account);
    if (result.status === 'ok') {
      queryClient.invalidateQueries({ queryKey: ['pagerduty', 'customFields', account ?? ''] });
      onSuccess();
    } else {
      setError(result.error);
    }
    setDeleting(false);
  };

  return (
    <Dialog
      isOpen={field !== null}
      onOpenChange={isOpen => !isOpen && handleClose()}
      width={440}
    >
      <DialogHeader>Delete Custom Field</DialogHeader>
      <DialogBody>
        {error && (
          <Box style={{ marginBottom: 16 }}>
            <Text variant="body-small" color="danger">{error}</Text>
          </Box>
        )}
        <Text>
          Are you sure you want to delete <strong>{field?.pagerdutyCustomFieldDisplayName}</strong>? This will remove the custom field from PagerDuty and reclaim its slot.
        </Text>
      </DialogBody>
      <DialogFooter>
        <Flex gap="2" justify="end">
          <Button variant="secondary" isDisabled={deleting} onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" isDisabled={deleting} onClick={handleConfirm}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </Flex>
      </DialogFooter>
    </Dialog>
  );
};
