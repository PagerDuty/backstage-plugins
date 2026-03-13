import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Flex,
  Text,
  TextField,
} from '@backstage/ui';
import { makeStyles, createStyles } from '@material-ui/core/styles';
import { BackstageTheme } from '@backstage/theme';

const useStyles = makeStyles<BackstageTheme>(theme =>
  createStyles({
    generalErrorBox: {
      backgroundColor: 'rgba(211, 47, 47, 0.08)',
      borderRadius: theme.shape.borderRadius,
      padding: `${theme.spacing(1)}px ${theme.spacing(1.5)}px`,
      marginBottom: theme.spacing(2),
    },
    fieldErrorText: {
      color: theme.palette.error.main,
      fontSize: '0.75rem',
      margin: `${theme.spacing(0.5)}px 0 0 0`,
    },
    descriptionLabel: {
      display: 'block',
      fontSize: '0.875rem',
      marginBottom: theme.spacing(0.75),
    },
    textarea: {
      width: '100%',
      boxSizing: 'border-box' as const,
      padding: `${theme.spacing(1)}px ${theme.spacing(1.5)}px`,
      fontSize: '0.875rem',
      border: `1px solid ${theme.palette.divider}`,
      borderRadius: theme.shape.borderRadius,
      resize: 'vertical' as const,
      fontFamily: 'inherit',
      color: 'inherit',
      backgroundColor: 'transparent',
      '&:disabled': {
        backgroundColor: theme.palette.action.disabledBackground,
      },
    },
  }),
);

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

  const handleFormChange = (field: keyof FormData) => (value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
  };

  const getSaveLabel = () => {
    return mode === 'edit' ? 'Save' : 'Add';
  };
  const saveLabel = getSaveLabel();

  return (
    <Dialog
      isOpen={open}
      onOpenChange={isOpen => !isOpen && handleClose()}
      width={500}
    >
      <DialogHeader>
        {mode === 'edit' ? 'Edit Custom Field' : 'Add New Custom Field'}
      </DialogHeader>
      <DialogBody>
        {localErrors.general && (
          <Box className={classes.generalErrorBox}>
            <Text variant="body-small" color="danger">
              {localErrors.general}
            </Text>
          </Box>
        )}
        <Flex direction="column" gap="4">
          <Box>
            <TextField
              label="Name"
              value={formData.name}
              onChange={handleFormChange('name')}
              isDisabled={saving}
              isInvalid={!!localErrors.name}
            />
            {localErrors.name && (
              <Text as="p" className={classes.fieldErrorText}>
                {localErrors.name}
              </Text>
            )}
          </Box>
          <Box>
            <TextField
              label="Entity Path"
              value={formData.entityPath}
              onChange={handleFormChange('entityPath')}
              isDisabled={saving}
              isInvalid={!!localErrors.entityPath}
            />
            {localErrors.entityPath && (
              <Text as="p" className={classes.fieldErrorText}>
                {localErrors.entityPath}
              </Text>
            )}
          </Box>
          <Box>
            <Text as="label" className={classes.descriptionLabel}>
              Description
            </Text>
            <textarea
              value={formData.description}
              onChange={e => handleFormChange('description')(e.target.value)}
              disabled={saving}
              rows={5}
              className={classes.textarea}
            />
          </Box>
        </Flex>
      </DialogBody>
      <DialogFooter>
        <Flex gap="2" justify="end">
          <Button variant="secondary" isDisabled={saving} onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            isDisabled={!formData.name || !formData.entityPath || saving}
          >
            {saveLabel}
          </Button>
        </Flex>
      </DialogFooter>
    </Dialog>
  );
};
