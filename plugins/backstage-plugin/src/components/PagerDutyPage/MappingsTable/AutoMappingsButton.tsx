import { Button, Flex } from '@backstage/ui';
import { Rocket, Check, Close } from '@mui/icons-material';
import { CircularProgress } from '@material-ui/core';

interface AutoMappingsButtonProps {
  hasMatches: boolean;
  onAutoMapping: () => void;
  onConfirmMappings: () => void;
  onClearMappings: () => void;
  isConfirming?: boolean;
}

export default function AutoMappingsButton({
  hasMatches,
  onAutoMapping,
  onConfirmMappings,
  onClearMappings,
  isConfirming = false,
}: AutoMappingsButtonProps) {
  if (hasMatches) {
    return (
      <Flex gap="2">
        <Button
          variant="secondary"
          onClick={onClearMappings}
          iconStart={<Close />}
          isDisabled={isConfirming}
        >
          Clear Mappings
        </Button>
        <Button
          style={{
            background: '#00875a',
          }}
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
        >
          {isConfirming ? 'Saving mappings...' : 'Confirm Mappings'}
        </Button>
      </Flex>
    );
  }

  return (
    <Button variant="tertiary" onClick={onAutoMapping} iconStart={<Rocket />}>
      Auto-Mapping
      <div
        style={{
          backgroundColor: '#00875a',
          color: 'white',
          fontSize: '11px',
          fontWeight: 'bold',
          padding: '2px 6px',
          borderRadius: '4px',
        }}
      >
        NEW
      </div>
    </Button>
  );
}
