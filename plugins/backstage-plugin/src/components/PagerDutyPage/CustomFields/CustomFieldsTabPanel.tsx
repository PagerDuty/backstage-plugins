import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ButtonIcon,
  CellText,
  Menu,
  MenuItem,
  MenuTrigger,
  Table,
  type ColumnConfig,
} from '@backstage/ui';
import { Delete, Edit, MoreVert, ToggleOff, ToggleOn } from '@mui/icons-material';
import Snackbar from '@mui/material/Snackbar';
import { Alert } from '@material-ui/lab';
import { useApi } from '@backstage/core-plugin-api';
import { pagerDutyApiRef } from '../../../api';
import { BackstageCustomField } from '@pagerduty/backstage-plugin-common';
import { CustomFieldModal, FieldErrors } from '../CustomFieldModal';
import { TableSkeleton } from '../MappingsTable/TableSkeleton';
import { useAccountContext } from '../AccountContext';
import { toFieldErrors } from './customFieldErrors';
import { CustomFieldsEmptyState } from './CustomFieldsEmptyState';
import { DeleteCustomFieldDialog } from './DeleteCustomFieldDialog';

export const CustomFieldsTabPanel = () => {
  const pagerDutyApi = useApi(pagerDutyApiRef);
  const queryClient = useQueryClient();
  const { selectedAccount } = useAccountContext();
  const account = selectedAccount || undefined;
  const [selectedCustomField, setSelectedCustomField] = useState<BackstageCustomField | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<FieldErrors | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [fieldToDelete, setFieldToDelete] = useState<BackstageCustomField | null>(null);

  const { data: customFieldsData, isLoading } = useQuery({
    queryKey: ['pagerduty', 'customFields', account ?? ''],
    queryFn: () => pagerDutyApi.getCustomFields(account),
  });
  const customFields = customFieldsData?.customFields ?? [];

  const handleOpenEditModal = useCallback((field: BackstageCustomField) => {
    setSelectedCustomField(field);
    setEditError(null);
    setIsEditModalOpen(true);
  }, []);

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedCustomField(null);
    setEditError(null);
  };

  const handleUpdateCustomField = async (formData: { name: string; entityPath: string; description: string }) => {
    if (!selectedCustomField) return;
    const fieldId = selectedCustomField.id;
    setEditSaving(true);
    setEditError(null);
    const result = await pagerDutyApi.updateCustomField(fieldId, formData, account);
    if (result.status === 'ok') {
      queryClient.invalidateQueries({ queryKey: ['pagerduty', 'customFields', account ?? ''] });
      setIsEditModalOpen(false);
      setSelectedCustomField(null);
    } else {
      setEditError(toFieldErrors(result.error));
    }
    setEditSaving(false);
  };

  const handleToggleEnabled = useCallback(async (field: BackstageCustomField) => {
    const nextEnabled = !field.pagerdutyCustomFieldEnabled;
    const result = await pagerDutyApi.setCustomFieldEnabled(field.id, nextEnabled, account);
    if (result.status === 'ok') {
      queryClient.invalidateQueries({ queryKey: ['pagerduty', 'customFields', account ?? ''] });
    } else {
      setToggleError(result.error);
    }
  }, [pagerDutyApi, account, queryClient]);

  const columnConfig: ColumnConfig<BackstageCustomField>[] = useMemo(() => [
    { id: 'name', label: 'Custom Field', isRowHeader: true, isSortable: false, cell: item => <CellText title={item.pagerdutyCustomFieldDisplayName} /> },
    { id: 'entityPath', label: 'Entity Path', isRowHeader: false, isSortable: false, cell: item => <CellText title={item.backstageEntityMappingPath} /> },
    { id: 'description', label: 'Description', isRowHeader: false, isSortable: false, cell: item => <CellText title={item.description ?? ''} /> },
    {
      id: 'actions', label: '', isRowHeader: false, isSortable: false,
      cell: item => (
        <CellText title="" leadingIcon={
          <MenuTrigger>
            <ButtonIcon icon={<MoreVert fontSize="small" />} aria-label="actions" variant="tertiary" size="small" />
            <Menu>
              <MenuItem iconStart={<Edit fontSize="small" />} onAction={() => handleOpenEditModal(item)}>Edit</MenuItem>
              <MenuItem
                iconStart={
                  item.pagerdutyCustomFieldEnabled ? (
                    <ToggleOn fontSize="small" />
                  ) : (
                    <ToggleOff fontSize="small" />
                  )
                }
                onAction={() => handleToggleEnabled(item)}
              >
                {item.pagerdutyCustomFieldEnabled ? 'Disable' : 'Enable'}
              </MenuItem>
              <MenuItem iconStart={<Delete fontSize="small" />} onAction={() => setFieldToDelete(item)}>Delete</MenuItem>
            </Menu>
          </MenuTrigger>
        } />
      ),
    },
  ], [handleOpenEditModal, handleToggleEnabled]);

  return (
    <>
      {isLoading ? (
        <TableSkeleton
          columns={[
            { label: 'Custom Field', width: '30%' },
            { label: 'Entity Path', width: '25%' },
            { label: 'Description', width: '35%' },
            { label: '', width: '10%' },
          ]}
        />
      ) : (
        <Table
          columnConfig={columnConfig}
          data={customFields}
          pagination={{ type: 'none' }}
          rowConfig={{
            getIsDisabled: item => !item.pagerdutyCustomFieldEnabled,
          }}
          emptyState={
            <CustomFieldsEmptyState message='No custom fields have been added' />
          }
        />
      )}

      <CustomFieldModal
        open={isEditModalOpen}
        saving={editSaving}
        error={editError}
        onClose={handleCloseEditModal}
        onSave={handleUpdateCustomField}
        mode="edit"
        initialValues={selectedCustomField ? {
          name: selectedCustomField.pagerdutyCustomFieldDisplayName,
          entityPath: selectedCustomField.backstageEntityMappingPath,
          description: selectedCustomField.description ?? '',
        } : undefined}
      />

      <DeleteCustomFieldDialog
        field={fieldToDelete}
        onClose={() => setFieldToDelete(null)}
        onSuccess={() => setFieldToDelete(null)}
      />

      <Snackbar
        open={toggleError !== null}
        autoHideDuration={5000}
        onClose={() => setToggleError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="error" onClose={() => setToggleError(null)}>
          {toggleError}
        </Alert>
      </Snackbar>
    </>
  );
};
