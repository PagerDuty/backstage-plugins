import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Link,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@material-ui/core';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import EditIcon from '@material-ui/icons/Edit';
import BlockIcon from '@material-ui/icons/Block';
import DeleteIcon from '@material-ui/icons/Delete';
import { createStyles, makeStyles } from '@material-ui/core/styles';
import { BackstageTheme } from '@backstage/theme';
import { useApi } from '@backstage/core-plugin-api';
import { pagerDutyApiRef } from '../../api';
import { BackstageCustomField } from '@pagerduty/backstage-plugin-common';
import { AddCustomFieldModal, FieldErrors } from './AddCustomFieldModal';


const useStyles = makeStyles<BackstageTheme>(theme => {
  return createStyles({
    root: {
      padding: theme.spacing(3),
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing(1),
    },
    explanation: {
      color: theme.palette.text.secondary,
      marginBottom: theme.spacing(3),
    },
    sectionHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing(0.5),
    },
    sectionTitle: {
      fontWeight: 700,
    },
    sectionSubtitle: {
      color: theme.palette.text.secondary,
      marginBottom: theme.spacing(1),
    },
    availableMappings: {
      color: theme.palette.text.secondary,
      fontSize: '0.875rem',
    },
    addLink: {
      color: theme.palette.primary.main,
      cursor: 'pointer',
      fontSize: '0.875rem',
    },
    sectionMeta: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: theme.spacing(0.5),
    },
    tableHeader: {
      backgroundColor: theme.palette.background.default,
    },
    tableHeaderCell: {
      fontWeight: 700,
    },
    emptyState: {
      textAlign: 'center',
      padding: theme.spacing(4),
      color: theme.palette.text.secondary,
    },
    footer: {
      display: 'flex',
      justifyContent: 'flex-end',
      marginTop: theme.spacing(3),
    },
    saveButton: {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.primary.contrastText,
      '&:hover': {
        backgroundColor: theme.palette.primary.dark,
      },
    },
    loading: {
      display: 'flex',
      justifyContent: 'center',
      padding: theme.spacing(4),
    },
  });
});

/** @public */
export const CustomFieldsTab = () => {
  const classes = useStyles();
  const pagerDutyApi = useApi(pagerDutyApiRef);
  const [customFields, setCustomFields] = useState<BackstageCustomField[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<FieldErrors | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [menuField, setMenuField] = useState<BackstageCustomField | null>(null);
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

  // Fetch custom fields on mount
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

  const handleAddCustomField = () => {
    setIsModalOpen(true);
    setError(null);
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
      setCustomFields(prev => [...prev, result.data]);
      setIsModalOpen(false);
    } else {
      setError(toFieldErrors(result.error));
    }

    setSaving(false);
  };

  const handleOpenMenu = (
    event: React.MouseEvent<HTMLButtonElement>,
    field: BackstageCustomField,
  ) => {
    setMenuAnchorEl(event.currentTarget);
    setMenuField(field);
  };

  const handleCloseMenu = () => {
    setMenuAnchorEl(null);
  };

  const handleOpenEditModal = () => {
    handleCloseMenu();
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setMenuField(null);
    setEditError(null);
  };

  const handleUpdateCustomField = async (formData: {
    name: string;
    entityPath: string;
    description: string;
  }) => {
    if (!menuField) return;

    setEditSaving(true);
    setEditError(null);

    const result = await pagerDutyApi.updateCustomField(menuField.id, {
      name: formData.name,
      entityPath: formData.entityPath,
      description: formData.description,
    });

    if (result.status === 'ok') {
      setCustomFields(prev =>
        prev.map(f => (f.id === menuField.id ? result.data : f)),
      );
      setIsEditModalOpen(false);
      setMenuField(null);
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

  return (
    <Paper className={classes.root} elevation={1}>
      <Box className={classes.header}>
        <Typography variant="h5">Data Sync</Typography>
        <Button
          variant="contained"
          className={classes.saveButton}
          onClick={handleStartDataSync}
        >
          Start Data Sync
        </Button>
      </Box>

      {/* TODO: <Typography className={classes.explanation} variant="body2">
        //Explanation of what this is and does...
      </Typography> */}

      <Divider />

      <Box mt={2}>
        <Box className={classes.sectionHeader}>
          <Box>
            <Typography variant="subtitle1" className={classes.sectionTitle}>
              Custom Fields
            </Typography>
            <Typography variant="body2" className={classes.sectionSubtitle}>
              Manually manage your global data sync preferences
            </Typography>
          </Box>
          <Box className={classes.sectionMeta}>
            <Link
              className={classes.addLink}
              onClick={handleAddCustomField}
              underline="always"
            >
              + Add Custom Field
            </Link>
          </Box>
        </Box>

        {loading ? (
          <Box className={classes.loading}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead className={classes.tableHeader}>
                <TableRow>
                  <TableCell className={classes.tableHeaderCell}>
                    Custom Field
                  </TableCell>
                  <TableCell className={classes.tableHeaderCell}>
                    Entity Path
                  </TableCell>
                  <TableCell className={classes.tableHeaderCell} />
                </TableRow>
              </TableHead>
              <TableBody>
                {customFields.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className={classes.emptyState}>
                      No custom fields have been added
                    </TableCell>
                  </TableRow>
                ) : (
                  customFields.map(field => (
                    <TableRow key={field.id}>
                      <TableCell>{field.pagerdutyCustomFieldDisplayName}</TableCell>
                      <TableCell>{field.backstageEntityMappingPath}</TableCell>
                      <TableCell align="right" padding="none">
                        <IconButton
                          size="small"
                          aria-label="actions"
                          onClick={event => handleOpenMenu(event, field)}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Row action menu */}
        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={handleCloseMenu}
          keepMounted
        >
          <MenuItem onClick={handleOpenEditModal}>
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Edit" />
          </MenuItem>
          <MenuItem disabled>
            <ListItemIcon>
              <BlockIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Disable" />
          </MenuItem>
          <MenuItem disabled>
            <ListItemIcon>
              <DeleteIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Delete" />
          </MenuItem>
        </Menu>

        {/* Edit modal */}
        <AddCustomFieldModal
          open={isEditModalOpen}
          saving={editSaving}
          error={editError}
          onClose={handleCloseEditModal}
          onSave={handleUpdateCustomField}
          mode="edit"
          initialValues={
            menuField
              ? {
                  name: menuField.pagerdutyCustomFieldDisplayName,
                  entityPath: menuField.backstageEntityMappingPath,
                  description: menuField.description ?? '',
                }
              : undefined
          }
        />
      </Box>

      <Box className={classes.footer}>
        <Button variant="contained" className={classes.saveButton} onClick={handleSave}>
          Save
        </Button>
      </Box>

      <AddCustomFieldModal
        open={isModalOpen}
        saving={saving}
        error={error}
        onClose={handleCloseModal}
        onSave={handleSaveCustomField}
      />
    </Paper>
  );
};
