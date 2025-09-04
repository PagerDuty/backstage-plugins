import { useEffect } from 'react';
import { Theme, makeStyles } from '@material-ui/core/styles';
import { BackstageTheme } from '@backstage/theme';
import { useApi } from '@backstage/core-plugin-api';
import { pagerDutyApiRef } from '../../api';
import { useAsyncFn } from 'react-use';
import Alert from '@material-ui/lab/Alert/Alert';
import { Progress } from '@backstage/core-components';
import { Card } from '@backstage/ui';
import { Typography } from '@material-ui/core';

type Props = {
  serviceId: string;
  refreshStatus: boolean;
  account?: string;
  compact?: boolean;
};

function labelFromStatus(status: string) {
  let label;
  switch (status) {
    case 'active':
      label = 'OK';
      break;
    case 'warning':
      label = 'ACTIVE';
      break;
    case 'critical':
      label = 'ALARM';
      break;
    case 'maintenance':
      label = 'MAINTENANCE';
      break;
    case 'disabled':
      label = 'DISABLED';
      break;
    default:
      label = 'OK';
      break;
  }

  return label;
}

function colorFromStatus(theme: Theme, status: string) {
  let color;
  switch (status) {
    case 'active':
      color = theme.palette.success.main;
      break;
    case 'warning':
      color = theme.palette.warningBackground;
      break;
    case 'critical':
      color = theme.palette.error.main;
      break;
    case 'maintenance':
      color = '#ebdc00';
      break;
    case 'disabled':
      color = '#A9A9A9';
      break;
    default:
      color = theme.palette.success.main;
      break;
  }

  return color;
}

function StatusCard({ serviceId, refreshStatus, account, compact }: Props) {
  const api = useApi(pagerDutyApiRef);
  const [{ value: status, loading, error }, getStatus] = useAsyncFn(
    async () => {
      const { service: foundService } = await api.getServiceById(
        serviceId,
        account,
      );
      return foundService.status;
    },
  );

  const useStyles = makeStyles<BackstageTheme>(theme => ({
    cardStyle: {
      height: compact !== true ? '120px' : '80px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        status !== undefined
          ? colorFromStatus(theme, status)
          : colorFromStatus(theme, 'active'),
    },
    largeTextStyle: {
      color: 'white',
      fontWeight: 'bold',
      fontSize: '20px',
      wordWrap: 'break-word',
    },
  }));

  const { cardStyle, largeTextStyle } = useStyles();

  useEffect(() => {
    getStatus();
  }, [refreshStatus, getStatus]);

  if (error) {
    if (error.message.includes('Forbidden')) {
      return <Typography>forbidden</Typography>;
    }

    return (
      <Alert severity="error">
        Error encountered while fetching information. {error.message}
      </Alert>
    );
  }

  if (loading) {
    return <Progress />;
  }

  if (!status) {
    return <Typography>not found</Typography>;
  }

  return (
    <Card className={cardStyle}>
      {status !== undefined ? (
        <Typography className={largeTextStyle}>
          {labelFromStatus(status)}
        </Typography>
      ) : (
        <Typography className={largeTextStyle}>Unable to get status</Typography>
      )}
    </Card>
  );
}

export default StatusCard;
