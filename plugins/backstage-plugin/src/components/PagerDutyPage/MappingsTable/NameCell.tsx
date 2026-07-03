import { Cell, CellText } from '@backstage/ui';
import { makeStyles } from '@material-ui/core';
import { Link } from '@backstage/core-components';
import { DEFAULT_NAMESPACE } from '@backstage/catalog-model';
import { BackstageEntity } from '../../types';

const useStyles = makeStyles(theme => ({
  link: {
    textDecoration: 'underline',
    color: theme.palette.link,
    transition: 'color 0.15s',
    '&:hover': {
      opacity: 0.8,
    },
  },
}));

type NameCellProps = {
  entity: BackstageEntity;
};

function entityCatalogPath(entity: BackstageEntity): string | undefined {
  if (!entity.type || !entity.name) {
    return undefined;
  }

  const namespace = (entity.namespace || DEFAULT_NAMESPACE).toLowerCase();
  const kind = entity.type.toLowerCase();

  return `/catalog/${namespace}/${kind}/${entity.name}`;
}

export function NameCell({ entity }: NameCellProps) {
  const classes = useStyles();
  const to = entityCatalogPath(entity);

  if (!to) {
    return <CellText title={entity.name} />;
  }

  // Render the link via core-components' Link (react-router-aware) instead of
  // CellText's href, which emits a plain <a> and triggers a full page reload.
  return (
    <Cell>
      <Link to={to} className={classes.link} title={entity.name}>
        {entity.name}
      </Link>
    </Cell>
  );
}
