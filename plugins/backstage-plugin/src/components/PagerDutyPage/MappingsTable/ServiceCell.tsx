import { CellText } from '@backstage/ui';
import { makeStyles } from '@material-ui/core';
import { BackstageTheme } from '@backstage/theme';
import { BackstageEntity } from '../../types';

const useStyles = makeStyles<BackstageTheme>(() => ({
  underlinedCell: {
    '& .bui-Text': {
      textDecoration: 'underline',
      color: '#0066cc',
      transition: 'color 0.15s',
      '&:hover': {
        color: '#0052a3',
      },
    },
  },
}));

type ServiceCellProps = {
  entity: BackstageEntity;
};

export function ServiceCell({ entity }: ServiceCellProps) {
  const classes = useStyles();

  return (
    <CellText
      color="secondary"
      className={classes.underlinedCell}
      title={entity.serviceName ?? ''}
      href={entity.serviceUrl}
    />
  );
}
