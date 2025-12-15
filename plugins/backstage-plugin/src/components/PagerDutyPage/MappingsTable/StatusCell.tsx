import { Cell } from '@backstage/ui';
import { makeStyles } from '@material-ui/core';
import { BackstageEntity } from '../../types';

function getStatusName(status?: string) {
  switch (status) {
    case 'InSync':
      return 'In Sync';
    case 'OutOfSync':
      return 'Out of Sync';
    case 'NotMapped':
      return 'Not Mapped';
    default:
      return 'Refresh to Update';
  }
}

function getColorFromStatus(status?: string) {
  switch (status) {
    case 'InSync':
      return 'green';
    case 'OutOfSync':
      return 'red';
    case 'NotMapped':
      return 'orange';
    default:
      return 'gray';
  }
}

const useStyles = makeStyles(() => {
  return {
    pill: (props: { backgroundColor: string }) => ({
      '& .bui-Text': {
        backgroundColor: props.backgroundColor,
        borderRadius: '0.25rem',
        color: 'white',
        padding: '0.15rem',
      },
    }),
  };
});

export default function StatusCell({
  entity,
}: {
  entity: BackstageEntity;
}) {
  const statusValue = entity.status || 'NotMapped';
  const backgroundColor = getColorFromStatus(statusValue);
  const classes = useStyles({ backgroundColor });

  const statusName = getStatusName(statusValue);
  return <Cell title={statusName} className={classes.pill} />;
}
