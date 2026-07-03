import { Flex, Text, TextField } from '@backstage/ui';
import { ArrowForward } from '@mui/icons-material';
import { makeStyles, createStyles } from '@material-ui/core/styles';
import { BackstageTheme } from '@backstage/theme';

const useStyles = makeStyles<BackstageTheme>(theme =>
  createStyles({
    container: {
      padding: theme.spacing(6),
      width: '100%',
      textAlign: 'center',
    },
    inputWrapper: {
      width: '8rem',
      filter: 'brightness(0.88)'
    },
    inputWrapperDark: {
      width: '8rem',
      filter: 'brightness(0.5)',
    },
  }),
);

interface CustomFieldsEmptyStateProps {
  message: string;
}

export function CustomFieldsEmptyState({ message }: CustomFieldsEmptyStateProps) {
  const classes = useStyles();
  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      gap="3"
      className={classes.container}
    >
      <Flex align="center" gap="3" aria-hidden>
        <div className={classes.inputWrapper}>
          <TextField value="" isDisabled aria-label="" />
        </div>
        <ArrowForward fontSize="small" />
        <div className={classes.inputWrapperDark}>
          <TextField value="" isDisabled aria-label="" />
        </div>
      </Flex>
      <Text variant="body-medium" color="secondary">
        {message}
      </Text>
    </Flex>
  );
}
