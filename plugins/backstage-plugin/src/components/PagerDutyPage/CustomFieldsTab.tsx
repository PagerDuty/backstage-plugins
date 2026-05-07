import { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Button,
  CellText,
  Flex,
  Table,
  Text,
  useTable,
  type ColumnConfig,
} from '@backstage/ui';
import { Edit } from '@mui/icons-material';
import { makeStyles, createStyles } from '@material-ui/core/styles';
import { BackstageTheme } from '@backstage/theme';
import { useApi } from '@backstage/core-plugin-api';
import { pagerDutyApiRef } from '../../api';
import { BackstageCustomField } from '@pagerduty/backstage-plugin-common';
import { CustomFieldModal, FieldErrors } from './CustomFieldModal';

const useStyles = makeStyles<BackstageTheme>(theme =>
  createStyles({
    title: {
      margin: 0,
      fontSize: '1.5rem',
      fontWeight: 700,
    },
    divider: {
      border: 'none',
      borderTop: `1px solid ${theme.palette.divider}`,
      margin: `0 0 ${theme.spacing(2)}px 0`,
    },
    tabsRow: {
      marginBottom: theme.spacing(2),
    },
    tabActive: {
      margin: 0,
      fontWeight: 700,
      paddingBottom: theme.spacing(0.5),
      borderBottom: `2px solid ${theme.palette.text.primary}`,
      cursor: 'default',
    },
    tabInactive: {
      margin: 0,
      color: theme.palette.text.secondary,
      cursor: 'default',
    },
    manageRow: {
      marginBottom: theme.spacing(1.5),
    },
    manageText: {
      margin: 0,
      color: theme.palette.text.secondary,
    },
    errorBox: {
      padding: `${theme.spacing(1)}px ${theme.spacing(1.5)}px`,
      backgroundColor: 'rgba(255,0,0,0.08)',
      borderRadius: theme.shape.borderRadius,
      marginBottom: theme.spacing(1.5),
    },
    errorText: {
      color: theme.palette.error.main,
    },
    footer: {
      marginTop: theme.spacing(2),
    },
  }),
);

/** @public */
export const CustomFieldsTab = () => {
  const classes = useStyles();
  const pagerDutyApi = useApi(pagerDutyApiRef);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<FieldErrors | null>(null);
  const [selectedCustomField, setSelectedCustomField] = useState<BackstageCustomField | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<FieldErrors | null>(null);

  const toFieldErrors = (message: string): FieldErrors => {
    const lower = message.toLowerCase();
    if (lower.includes('name') && lower.includes('already exists')) {
      return {
        name: 'Entered Name matches one already in use. Please make changes to continue.',
      };
    }
    if (lower.includes('entity path') && lower.includes('already')) {
      return {
        entityPath:
          'Entered Entity Path matches one already in use. Please make changes to continue.',
      };
    }
    return { general: message };
  };


  const handleOpenModal = (field: BackstageCustomField | null = null) => {
    if (field) {
      setSelectedCustomField(field);
      setEditError(null);
      setIsEditModalOpen(true);
    } else {
      setIsModalOpen(true);
      setError(null);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setError(null);
  };

  const handleSaveCustomField = async (formData: {
    name: string;
    entityPath: string;
    description: string;
  }) => {
    setSaving(true);
    setError(null);

    const result = await pagerDutyApi.createCustomField({
      name: formData.name,
      entityPath: formData.entityPath,
      description: formData.description,
    });

    if (result.status === 'ok') {
      setIsModalOpen(false);
      reload();
    } else {
      setError(toFieldErrors(result.error));
    }

    setSaving(false);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedCustomField(null);
    setEditError(null);
  };

  const handleUpdateCustomField = async (formData: {
    name: string;
    entityPath: string;
    description: string;
  }) => {
    if (!selectedCustomField) return;

    // Capture field ID early to prevent race conditions
    const fieldId = selectedCustomField.id;

    setEditSaving(true);
    setEditError(null);

    const result = await pagerDutyApi.updateCustomField(fieldId, {
      name: formData.name,
      entityPath: formData.entityPath,
      description: formData.description,
    });

    if (result.status === 'ok') {
      setIsEditModalOpen(false);
      setSelectedCustomField(null);
      reload();
    } else {
      setEditError(toFieldErrors(result.error));
    }

    setEditSaving(false);
  };

  const handleStartDataSync = () => {
    // TODO: implement data sync trigger
  };

  const handleSave = () => {
    // TODO: implement save
  };

  const columnConfig: ColumnConfig<BackstageCustomField>[] = useMemo(
    () => [
      {
        id: 'name',
        label: 'Custom Field',
        isRowHeader: true,
        isSortable: false,
        cell: item => (
          <CellText title={item.pagerdutyCustomFieldDisplayName} />
        ),
      },
      {
        id: 'entityPath',
        label: 'Entity Path',
        isRowHeader: false,
        isSortable: false,
        cell: item => <CellText title={item.backstageEntityMappingPath} />,
      },
      {
        id: 'description',
        label: 'Description',
        isRowHeader: false,
        isSortable: false,
        cell: item => <CellText title={item.description ?? ''} />,
      },
      {
        id: 'actions',
        label: '',
        isRowHeader: false,
        isSortable: false,
        cell: item => (
          <CellText
            leadingIcon={<Edit fontSize="small" />}
            color="secondary"
            style={{ paddingLeft: '25px', cursor: 'pointer', maxWidth: 'min-content' }}
            title=""
            onClick={() => handleOpenModal(item)}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const getData = useCallback(async () => {
    setError(null);
    const response = await pagerDutyApi.getCustomFields();
    return response.customFields;
  }, [pagerDutyApi]);

  const { tableProps, reload } = useTable<BackstageCustomField>({
    mode: 'complete',
    getData,
  });

  return (
    <>
      {/* Data Sync header */}
      <Flex align="start" justify="between" style={{ marginBottom: 16 }}>
        <Text as="h2" className={classes.title}>
          Data Sync
        </Text>
        <Button variant="secondary" onClick={handleStartDataSync}>
          Start Data Sync
        </Button>
      </Flex>

      <hr className={classes.divider} />

      {/* Custom Fields / Activity Logs tabs */}
      <Flex align="center" justify="between" className={classes.tabsRow}>
        <Flex gap="4" align="center">
          <Text as="p" className={classes.tabActive}>
            Custom Fields
          </Text>
          <Text as="p" className={classes.tabInactive}>
            Activity Logs
          </Text>
        </Flex>
      </Flex>

      {/* Manage row */}
      <Flex align="center" justify="between" className={classes.manageRow}>
        <Text as="p" className={classes.manageText}>
          Manage your custom fields
        </Text>
        <Button variant="secondary" size="small" onClick={() => handleOpenModal()}>
          + Add New
        </Button>
      </Flex>

      {error?.general && (
        <Box className={classes.errorBox}>
          <Text className={classes.errorText}>{error.general}</Text>
        </Box>
      )}

      {/* Table */}
      <Table
        columnConfig={columnConfig}
        {...tableProps}
      />

      {/* Custom Field Modal */}
      <CustomFieldModal
        open={isEditModalOpen || isModalOpen}
        saving={isEditModalOpen ? editSaving : saving}
        error={isEditModalOpen ? editError : error}
        onClose={isEditModalOpen ? handleCloseEditModal : handleCloseModal}
        onSave={isEditModalOpen ? handleUpdateCustomField : handleSaveCustomField}
        mode={isEditModalOpen ? 'edit' : 'add'}
        initialValues={
          selectedCustomField
            ? {
                name: selectedCustomField.pagerdutyCustomFieldDisplayName,
                entityPath: selectedCustomField.backstageEntityMappingPath,
                description: selectedCustomField.description ?? '',
              }
            : undefined
        }
      />

      <Flex justify="end" className={classes.footer}>
        <Button variant="primary" onClick={handleSave} isDisabled>
          Save
        </Button>
      </Flex>
    </>
  );
};
