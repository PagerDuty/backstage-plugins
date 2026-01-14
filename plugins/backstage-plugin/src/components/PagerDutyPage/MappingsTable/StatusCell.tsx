import { CellText } from '@backstage/ui';
import { makeStyles } from '@material-ui/core';
import { BackstageEntity } from '../../types';

const statusDictionary = {
  InSync: 'In Sync',
  OutOfSync: 'Out of Sync',
  NotMapped: 'Not Mapped',
} as const;
const colourDictionary = {
  InSync: 'green',
  OutOfSync: 'red',
  NotMapped: 'orange',
} as const;

type StatusKey = keyof typeof statusDictionary;

function getStatusName(status: string) {
  return statusDictionary[status as StatusKey] || 'Refresh to Update';
}
function getColorFromStatus(status: string) {
  return colourDictionary[status as StatusKey] || 'gray';
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

export default function StatusCell({ entity }: { entity: BackstageEntity }) {
  const statusValue = entity.status || 'NotMapped';
  const backgroundColor = getColorFromStatus(statusValue);
  const classes = useStyles({ backgroundColor });

  const statusName = getStatusName(statusValue);
  return <CellText title={statusName} className={classes.pill} />;
}
