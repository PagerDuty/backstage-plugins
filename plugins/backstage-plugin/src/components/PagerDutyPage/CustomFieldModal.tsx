import { useState, useEffect, ChangeEvent } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from '@material-ui/core';
import { createStyles, makeStyles } from '@material-ui/core/styles';
import { BackstageTheme } from '@backstage/theme';
import CloseIcon from '@material-ui/icons/Close';
import { Alert } from '@material-ui/lab';

const useStyles = makeStyles<BackstageTheme>(theme => {
  return createStyles({
    dialogTitle: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingRight: theme.spacing(1),
    },
    dialogContent: {
      minWidth: 500,
      paddingTop: theme.spacing(2),
    },
    formField: {
      marginBottom: theme.spacing(2),
    },
    dialogActions: {
      padding: theme.spacing(2, 3),
    },
    addButton: {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.primary.contrastText,
      '&:hover': {
        backgroundColor: theme.palette.primary.dark,
      },
    },
    generalError: {
      marginBottom: theme.spacing(2),
    },
  });
});

interface FormData {
  name: string;
  entityPath: string;
  description: string;
}

/** @public */
export interface FieldErrors {
  name?: string;
  entityPath?: string;
  general?: string;
}

interface CustomFieldModalProps {
  open: boolean;
  saving: boolean;
  error: FieldErrors | null;
  onClose: () => void;
  onSave: (data: FormData) => Promise<void>;
  mode?: 'add' | 'edit';
  initialValues?: FormData;
}

/** @public */
export const CustomFieldModal = ({
  open,
  saving,
  error,
  onClose,
  onSave,
  mode = 'add',
  initialValues,
}: CustomFieldModalProps) => {
  const classes = useStyles();
  const [formData, setFormData] = useState<FormData>(
    initialValues ?? { name: '', entityPath: '', description: '' },
  );
  const [localErrors, setLocalErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (open) {
      setFormData(initialValues ?? { name: '', entityPath: '', description: '' });
      setLocalErrors({});
    }
  }, [open, initialValues]);

  useEffect(() => {
    setLocalErrors(error ?? {});
  }, [error]);

  const handleFormChange = (field: keyof FormData) => (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    setFormData(prev => ({ ...prev, [field]: event.target.value }));
    if (field in localErrors) {
      setLocalErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleClose = () => {
    setFormData({ name: '', entityPath: '', description: '' });
    setLocalErrors({});
    onClose();
  };

  const handleSave = async () => {
    await onSave(formData);
    setFormData({ name: '', entityPath: '', description: '' });
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle disableTypography>
        <Box className={classes.dialogTitle}>
          <Typography variant="h6">
            {mode === 'edit' ? 'Edit Custom Field' : 'Add New Custom Field'}
          </Typography>
          <IconButton aria-label="close" onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent className={classes.dialogContent}>
        {localErrors.general && (
          <Alert severity="error" className={classes.generalError}>
            {localErrors.general}
          </Alert>
        )}
        <TextField
          label="Name"
          value={formData.name}
          onChange={handleFormChange('name')}
          fullWidth
          variant="outlined"
          className={localErrors.name ? undefined : classes.formField}
          disabled={saving}
          error={!!localErrors.name}
          helperText={localErrors.name}
          FormHelperTextProps={{ style: { marginBottom: 16 } }}
        />
        <TextField
          label="Entity Path"
          value={formData.entityPath}
          onChange={handleFormChange('entityPath')}
          fullWidth
          variant="outlined"
          className={localErrors.entityPath ? undefined : classes.formField}
          disabled={saving}
          error={!!localErrors.entityPath}
          helperText={localErrors.entityPath}
          FormHelperTextProps={{ style: { marginBottom: 16 } }}
        />
        <TextField
          label="Description"
          value={formData.description}
          onChange={handleFormChange('description')}
          fullWidth
          variant="outlined"
          multiline
          rows={3}
          className={classes.formField}
          disabled={saving}
        />
      </DialogContent>
      <DialogActions className={classes.dialogActions}>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          className={classes.addButton}
          onClick={handleSave}
          disabled={!formData.name || !formData.entityPath || saving}
        >
          {saving
            ? mode === 'edit'
              ? 'Saving...'
              : 'Adding...'
            : mode === 'edit'
            ? 'Save'
            : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
