import { Alert } from '@material-ui/lab';
import Snackbar from '@mui/material/Snackbar';
import { CheckCircle, Error as ErrorIcon } from '@mui/icons-material';

export interface MappingCounts {
  created?: number;
  skipped?: number;
  errored?: number;
}

export type ToastSeverity = 'success' | 'error';

interface MappingToastProps {
  open: boolean;
  severity: ToastSeverity;
  message: string;
  totalMatches?: number;
  mappingCounts?: MappingCounts;
  onClose: () => void;
}

export default function MappingToast({
  open,
  severity,
  message,
  totalMatches = 0,
  mappingCounts = {},
  onClose,
}: MappingToastProps) {
  const getTitle = () => {
    if (severity === 'error') {
      return 'Error';
    }
    return totalMatches > 0 ? 'Mapping Calculation Complete' : 'Mappings Saved';
  };

  const hasDetailedCounts =
    mappingCounts.created !== undefined ||
    mappingCounts.skipped !== undefined ||
    mappingCounts.errored !== undefined;

  return (
    <Snackbar
      open={open}
      autoHideDuration={3000}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <Alert
        onClose={onClose}
        severity={severity}
        icon={severity === 'success' ? <CheckCircle /> : <ErrorIcon />}
      >
        <strong>{getTitle()}</strong>
        <br />
        {hasDetailedCounts ? (
          <>
            {mappingCounts.created !== undefined &&
              mappingCounts.created > 0 && (
                <>Created: {mappingCounts.created}</>
              )}
            {mappingCounts.skipped !== undefined &&
              mappingCounts.skipped > 0 && (
                <>
                  {mappingCounts.created !== undefined &&
                    mappingCounts.created > 0 &&
                    ' | '}
                  Skipped: {mappingCounts.skipped}
                </>
              )}
            {mappingCounts.errored !== undefined &&
              mappingCounts.errored > 0 && (
                <>
                  {((mappingCounts.created !== undefined &&
                    mappingCounts.created > 0) ||
                    (mappingCounts.skipped !== undefined &&
                      mappingCounts.skipped > 0)) &&
                    ' | '}
                  Errors: {mappingCounts.errored}
                </>
              )}
          </>
        ) : (
          message
        )}
      </Alert>
    </Snackbar>
  );
}
