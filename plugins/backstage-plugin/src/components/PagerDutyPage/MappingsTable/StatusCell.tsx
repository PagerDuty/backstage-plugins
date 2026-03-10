import { CellText } from '@backstage/ui';
import { makeStyles } from '@material-ui/core';
import { BackstageTheme } from '@backstage/theme';
import { BackstageEntity } from '../../types';

const statusDictionary = {
  InSync: 'In Sync',
  OutOfSync: 'Out of Sync',
  NotMapped: 'Not Mapped',
  AutoMapped: 'Auto Mapped',
  ErrorWhenFetchingService: 'Error occured while fetching service',
} as const;
const colourDictionary = {
  InSync: '#00875A',
  OutOfSync: '#fff',
  NotMapped: '#B88A00',
  AutoMapped: '#1565C0',
  ErrorWhenFetchingService: '#fff',
} as const;
const borderColorDictionary = {
  InSync: '#57D9A3',
  OutOfSync: 'red',
  NotMapped: '#E8C547',
  AutoMapped: '#64B5F6',
  ErrorWhenFetchingService: 'red',
} as const;
const backgroundColorDictionary = {
  InSync: '#E3FCEF',
  OutOfSync: 'red',
  NotMapped: '#FFF8E6',
  AutoMapped: '#E3F2FD',
  ErrorWhenFetchingService: 'red',
} as const;

type StatusKey = keyof typeof statusDictionary;

function getStatusName(status: string) {
  return statusDictionary[status as StatusKey] || 'Refresh to Update';
}
function getColorFromStatus(status: string) {
  return colourDictionary[status as StatusKey] || 'gray';
}
function getBorderColorFromStatus(status: string) {
  return borderColorDictionary[status as StatusKey] || 'gray';
}
function getBackgroundColorFromStatus(status: string) {
  return backgroundColorDictionary[status as StatusKey] || '#f0f0f0';
}

interface StyleProps {
  color: string;
  backgroundColor: string;
  borderColor: string;
}

const useStyles = makeStyles<BackstageTheme, StyleProps>(() => {
  return {
    pill: (props: StyleProps) => ({
      '& .bui-Text': {
        backgroundColor: props.backgroundColor,
        borderRadius: '4px',
        color: props.color,
        padding: '4px 12px',
        maxWidth: 'min-content',
        fontSize: '12px',
        fontWeight: 500,
        border: `1px solid ${props.borderColor}`,
        display: 'inline-block',
      },
    }),
  };
});

export default function StatusCell({ entity }: { entity: BackstageEntity }) {
  const statusValue = entity.status || 'NotMapped';
  const color = getColorFromStatus(statusValue);
  const backgroundColor = getBackgroundColorFromStatus(statusValue);
  const borderColor = getBorderColorFromStatus(statusValue);
  const classes = useStyles({ color, backgroundColor, borderColor });

  const statusName = getStatusName(statusValue);
  return <CellText title={statusName} className={classes.pill} />;
}
