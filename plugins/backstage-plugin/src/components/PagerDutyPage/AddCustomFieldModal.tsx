import { useState, ChangeEvent } from 'react';
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
    error: {
      marginBottom: theme.spacing(2),
    },
  });
});

interface FormData {
  name: string;
  entityPath: string;
  description: string;
}

interface AddCustomFieldModalProps {
  open: boolean;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (data: FormData) => Promise<void>;
}

/** @public */
export const AddCustomFieldModal = ({
  open,
  saving,
  error,
  onClose,
  onSave,
}: AddCustomFieldModalProps) => {
  const classes = useStyles();
  const [formData, setFormData] = useState<FormData>({
    name: '',
    entityPath: '',
    description: '',
  });

  const handleFormChange = (field: keyof FormData) => (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({ ...prev, [field]: event.target.value }));
  };

  const handleClose = () => {
    setFormData({ name: '', entityPath: '', description: '' });
    onClose();
  };

  const handleSave = async () => {
    await onSave(formData);
    setFormData({ name: '', entityPath: '', description: '' });
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle disableTypography>
        <Box className={classes.dialogTitle}>
          <Typography variant="h6">Add New Custom Field</Typography>
          <IconButton
            aria-label="close"
            onClick={handleClose}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent className={classes.dialogContent}>
        {error && (
          <Alert severity="error" className={classes.error}>
            {error}
          </Alert>
        )}
        <TextField
          label="Name"
          value={formData.name}
          onChange={handleFormChange('name')}
          fullWidth
          variant="outlined"
          className={classes.formField}
          disabled={saving}
        />
        <TextField
          label="Entity Path"
          value={formData.entityPath}
          onChange={handleFormChange('entityPath')}
          fullWidth
          variant="outlined"
          className={classes.formField}
          disabled={saving}
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
          {saving ? 'Adding...' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
