import { CellText } from '@backstage/ui';
import { makeStyles } from '@material-ui/core';
import { DEFAULT_NAMESPACE } from '@backstage/catalog-model';
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

type NameCellProps = {
  entity: BackstageEntity;
};

function entityCatalogHref(entity: BackstageEntity): string | undefined {
  if (!entity.type || !entity.name) {
    return undefined;
  }

  const namespace = (entity.namespace || DEFAULT_NAMESPACE).toLowerCase();
  const kind = entity.type.toLowerCase();

  return `/catalog/${namespace}/${kind}/${entity.name}`;
}

export function NameCell({ entity }: NameCellProps) {
  const classes = useStyles();
  const href = entityCatalogHref(entity);

  if (!href) {
    return <CellText title={entity.name} />;
  }

  return (
    <CellText
      className={classes.underlinedCell}
      title={entity.name}
      href={href}
    />
  );
}
