import { Button, Flex } from '@backstage/ui';
import { Rocket, Check, Close } from '@mui/icons-material';
import { CircularProgress, makeStyles } from '@material-ui/core';
import { BackstageTheme } from '@backstage/theme';

interface AutoMappingsButtonProps {
  hasMatches: boolean;
  onAutoMapping: () => void;
  onConfirmMappings: () => void;
  onClearMappings: () => void;
  isConfirming?: boolean;
}

const useStyles = makeStyles<BackstageTheme>(() => ({
  newBadge: {
    display: 'inline-block',
    backgroundColor: '#00A67E',
    color: 'white',
    fontSize: '9px',
    fontWeight: 600,
    textTransform: 'uppercase',
    padding: '2px 5px',
    borderRadius: '3px',
    letterSpacing: '0.3px',
    marginLeft: '6px',
  },
  confirmButton: {
    backgroundColor: '#00875A',
    '&:hover': {
      backgroundColor: '#006644',
    },
  },
  clearButton: {
    border: '1px solid #d0d0d0',
    '&:hover': {
      backgroundColor: '#f5f5f5',
      borderColor: '#999',
    },
  },
}));

export default function AutoMappingsButton({
  hasMatches,
  onAutoMapping,
  onConfirmMappings,
  onClearMappings,
  isConfirming = false,
}: AutoMappingsButtonProps) {
  const classes = useStyles();

  if (hasMatches) {
    return (
      <Flex gap="2">
        <Button
          variant="secondary"
          onClick={onClearMappings}
          iconStart={<Close />}
          isDisabled={isConfirming}
          className={classes.clearButton}
        >
          Clear Mappings
        </Button>
        <Button
          variant="primary"
          onClick={onConfirmMappings}
          iconStart={
            isConfirming ? (
              <CircularProgress size={16} style={{ color: 'white' }} />
            ) : (
              <Check />
            )
          }
          isDisabled={isConfirming}
          className={classes.confirmButton}
        >
          {isConfirming ? 'Saving mappings...' : 'Confirm Mappings'}
        </Button>
      </Flex>
    );
  }

  return (
    <Button variant="tertiary" onClick={onAutoMapping} iconStart={<Rocket />}>
      Auto-Mapping
      <div className={classes.newBadge}>NEW</div>
    </Button>
  );
}
