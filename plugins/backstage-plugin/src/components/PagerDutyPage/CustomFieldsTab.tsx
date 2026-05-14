import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Button,
  ButtonIcon,
  Card,
  CardBody,
  CellText,
  Flex,
  Menu,
  MenuItem,
  MenuTrigger,
  Table,
  Text,
  useTable,
  type ColumnConfig,
} from '@backstage/ui';
import { Edit, MoreVert } from '@mui/icons-material';
import { useApi } from '@backstage/core-plugin-api';
import { pagerDutyApiRef } from '../../api';
import { BackstageCustomField } from '@pagerduty/backstage-plugin-common';
import { CustomFieldModal, FieldErrors } from './CustomFieldModal';
import { TableSkeleton } from './MappingsTable/TableSkeleton';

const styles = {
  header: { marginBottom: 16 },
  title: { fontWeight: 700 },
  divider: { border: 'none', borderTop: '1px solid rgba(0,0,0,0.12)', margin: '0 0 16px 0' },
  tabsRow: { marginBottom: 12 },
  activeTab: { margin: 0, fontWeight: 700, borderBottom: '2px solid currentColor', paddingBottom: 4, cursor: 'default' },
  inactiveTab: { margin: 0, opacity: 0.6, cursor: 'default' },
  subheader: { marginBottom: 12 },
  subheaderText: { margin: 0, opacity: 0.7 },
  errorText: { color: 'red', marginBottom: 12 },
  actionsCell: { textAlign: 'end' },
  footer: { marginTop: 16 },
};

/** @public */
export const CustomFieldsTab = () => {
  const pagerDutyApi = useApi(pagerDutyApiRef);
  const [customFields, setCustomFields] = useState<BackstageCustomField[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<FieldErrors | null>(null);
  const [selectedCustomField, setSelectedCustomField] = useState<BackstageCustomField | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<FieldErrors | null>(null);

  const customFieldsRef = useRef(customFields);
  customFieldsRef.current = customFields;

  const { tableProps, reload } = useTable<BackstageCustomField>({
    mode: 'offset',
    getData: async ({ offset, pageSize }) => ({
      data: customFieldsRef.current.slice(offset, offset + pageSize),
      totalCount: customFieldsRef.current.length,
    }),
    paginationOptions: {
      pageSize: 10,
      pageSizeOptions: [10, 25, 50],
    },
  });

  useEffect(() => {
    reload();
  }, [customFields, reload]);

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

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await pagerDutyApi.getCustomFields();
        setCustomFields(response.customFields);
      } catch (err) {
        setError({
          general:
            err instanceof Error ? err.message : 'Failed to load custom fields',
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [pagerDutyApi]);

  const handleOpenModal = useCallback((field: BackstageCustomField | null = null) => {
    if (field) {
      setSelectedCustomField(field);
      setEditError(null);
      setIsEditModalOpen(true);
    } else {
      setIsModalOpen(true);
      setError(null);
    }
  }, []);

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
      setCustomFields(prev => [...prev, result.data]);
      setIsModalOpen(false);
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
      setCustomFields(prev =>
        prev.map(f => (f.id === fieldId ? result.data : f)),
      );
      setIsEditModalOpen(false);
      setSelectedCustomField(null);
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

  const columnConfig: ColumnConfig<BackstageCustomField>[] = useMemo(() => [
    {
      id: 'name',
      label: 'Custom Field',
      isRowHeader: true,
      isSortable: false,
      cell: item => <CellText title={item.pagerdutyCustomFieldDisplayName} />,
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
          title=""
          leadingIcon={
            <MenuTrigger>
              <ButtonIcon
                icon={<MoreVert fontSize="small" />}
                aria-label="actions"
                variant="tertiary"
                size="small"
              />
              <Menu>
                <MenuItem
                  iconStart={<Edit fontSize="small" />}
                  onAction={() => handleOpenModal(item)}
                >
                  Edit
                </MenuItem>
              </Menu>
            </MenuTrigger>
          }
        />
      ),
    },
  ], [handleOpenModal]);

  return (
    <Card>
      <CardBody>
        <Flex align="start" justify="between" style={styles.header}>
          <Text variant="title-medium" style={styles.title}>Data Sync</Text>
          <Button variant="secondary" onClick={handleStartDataSync}>
            Start Data Sync
          </Button>
        </Flex>

        <hr style={styles.divider} />

        <Flex align="center" justify="between" style={styles.tabsRow}>
          <Flex gap="4" align="center">
            <Text as="p" style={styles.activeTab}>
              Custom Fields
            </Text>
            <Text as="p" style={styles.inactiveTab}>
              Activity Logs
            </Text>
          </Flex>
        </Flex>

        <Flex align="center" justify="between" style={styles.subheader}>
          <Text as="p" style={styles.subheaderText}>Manage your custom fields</Text>
          <Button variant="secondary" size="small" onClick={() => handleOpenModal()}>
            + Add New
          </Button>
        </Flex>

        {error?.general && (
          <Text style={styles.errorText}>{error.general}</Text>
        )}

        {loading ? (
          <TableSkeleton />
        ) : (
          <Table
            columnConfig={columnConfig}
            {...tableProps}
            emptyState={<Text>No custom fields have been added</Text>}
          />
        )}

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

        <Flex justify="end" style={styles.footer}>
          <Button variant="primary" onClick={handleSave} isDisabled>
            Save
          </Button>
        </Flex>
      </CardBody>
    </Card>
  );
};
