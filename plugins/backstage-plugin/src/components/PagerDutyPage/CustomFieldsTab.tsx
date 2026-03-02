import { useState } from 'react';
import {
  Box,
  Button,
  Divider,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@material-ui/core';
import { createStyles, makeStyles } from '@material-ui/core/styles';
import { BackstageTheme } from '@backstage/theme';

type CustomField = {
  id: string;
  customField: string;
  entityPath: string;
};

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
  });
});

/** @public */
export const CustomFieldsTab = () => {
  const classes = useStyles();
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  const handleAddCustomField = () => {
    const id = window.crypto.randomUUID();
    setCustomFields(prev => [
      ...prev,
      { id, customField: '', entityPath: '' },
    ]);
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
              </TableRow>
            </TableHead>
            <TableBody>
              {customFields.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className={classes.emptyState}>
                    No custom fields have been added
                  </TableCell>
                </TableRow>
              ) : (
                customFields.map(field => (
                  <TableRow key={field.id}>
                    <TableCell>{field.customField}</TableCell>
                    <TableCell>{field.entityPath}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Box className={classes.footer}>
        <Button variant="contained" className={classes.saveButton} onClick={handleSave}>
          Save
        </Button>
      </Box>
    </Paper>
  );
};
