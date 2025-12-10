import { Cell } from '@backstage/ui';
import { makeStyles } from '@material-ui/core';
import { BackstageEntity } from '../../types';

const useStyles = makeStyles(() => ({
  underlinedCell: {
    '& .bui-Text': {
      textDecoration: 'underline',
    },
  },
}));

type ServiceCellProps = {
  entity: BackstageEntity;
};

export function ServiceCell({ entity }: ServiceCellProps) {
  const classes = useStyles();

  return (
    <Cell
      color="secondary"
      className={classes.underlinedCell}
      title={entity.serviceName ?? ''}
      href={entity.serviceUrl}
    />
  );
}
