import { CellText } from '@backstage/ui';
import { makeStyles, useTheme } from '@material-ui/core';
import { BackstageTheme } from '@backstage/theme';
import { BackstageEntity } from '../../types';

const statusDictionary = {
  InSync: 'In Sync',
  OutOfSync: 'Out of Sync',
  NotMapped: 'Not Mapped',
  AutoMapped: 'Auto Mapped',
  ErrorWhenFetchingService: 'Error occured while fetching service',
} as const;

type StatusKey = keyof typeof statusDictionary;

function getStatusName(status: string) {
  return statusDictionary[status as StatusKey] || 'Refresh to Update';
}

function getStatusColors(status: string, isDarkTheme: boolean) {
  const statusKey = status as StatusKey;

  if (isDarkTheme) {
    const darkColors = {
      InSync: {
        color: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.15)',
        borderColor: 'rgba(76, 175, 80, 0.4)',
      },
      OutOfSync: {
        color: '#f44336',
        backgroundColor: 'rgba(244, 67, 54, 0.15)',
        borderColor: 'rgba(244, 67, 54, 0.4)',
      },
      NotMapped: {
        color: '#FFA726',
        backgroundColor: 'rgba(255, 167, 38, 0.15)',
        borderColor: 'rgba(255, 167, 38, 0.4)',
      },
      AutoMapped: {
        color: '#42A5F5',
        backgroundColor: 'rgba(66, 165, 245, 0.15)',
        borderColor: 'rgba(66, 165, 245, 0.4)',
      },
      ErrorWhenFetchingService: {
        color: '#f44336',
        backgroundColor: 'rgba(244, 67, 54, 0.15)',
        borderColor: 'rgba(244, 67, 54, 0.4)',
      },
    };
    return darkColors[statusKey] || {
      color: '#999',
      backgroundColor: 'rgba(153, 153, 153, 0.15)',
      borderColor: 'rgba(153, 153, 153, 0.4)',
    };
  }

  const lightColors = {
    InSync: {
      color: '#00875A',
      backgroundColor: '#E3FCEF',
      borderColor: '#57D9A3',
    },
    OutOfSync: {
      color: '#fff',
      backgroundColor: 'red',
      borderColor: 'red',
    },
    NotMapped: {
      color: '#B88A00',
      backgroundColor: '#FFF8E6',
      borderColor: '#E8C547',
    },
    AutoMapped: {
      color: '#1565C0',
      backgroundColor: '#E3F2FD',
      borderColor: '#64B5F6',
    },
    ErrorWhenFetchingService: {
      color: '#fff',
      backgroundColor: 'red',
      borderColor: 'red',
    },
  };
  return lightColors[statusKey] || {
    color: 'gray',
    backgroundColor: '#f0f0f0',
    borderColor: 'gray',
  };
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
  const theme = useTheme<BackstageTheme>();
  const isDarkTheme = theme.palette.type === 'dark';
  const statusValue = entity.status || 'NotMapped';
  const { color, backgroundColor, borderColor } = getStatusColors(statusValue, isDarkTheme);
  const classes = useStyles({ color, backgroundColor, borderColor });

  const statusName = getStatusName(statusValue);
  return <CellText title={statusName} className={classes.pill} />;
}
