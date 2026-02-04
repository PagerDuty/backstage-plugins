import { Alert } from '@material-ui/lab';
import Snackbar from '@mui/material/Snackbar';
import { CheckCircle, Error as ErrorIcon } from '@mui/icons-material';
import { MappingCounts } from './hooks/useMappingToast';

interface MappingToastProps {
  open: boolean;
  onClose: () => void;
  severity: 'success' | 'error';
  message: string;
  totalMatches?: number;
  mappingCounts?: MappingCounts;
}

export default function MappingToast({
  open,
  onClose,
  severity,
  message,
  totalMatches = 0,
  mappingCounts = {},
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
            {mappingCounts.created !== undefined && mappingCounts.created > 0 && (
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
