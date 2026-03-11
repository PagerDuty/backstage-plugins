import { CellText } from '@backstage/ui';
import { makeStyles } from '@material-ui/core';
import { BackstageEntity } from '../../types';

const useStyles = makeStyles(theme => ({
  underlinedCell: {
    '& .bui-Text': {
      textDecoration: 'underline',
      color: theme.palette.link,
      transition: 'color 0.15s',
      '&:hover': {
        opacity: 0.8,
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
