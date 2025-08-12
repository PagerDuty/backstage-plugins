import { BackstageTheme } from '@backstage/theme';
import {
  LinearProgress,
  Theme,
  Typography,
  makeStyles,
  withStyles,
} from '@material-ui/core';
import InfoIcon from '@material-ui/icons/Info';
import { PagerDutyServiceStandard } from '@pagerduty/backstage-plugin-common';
import CheckCircle from '@material-ui/icons/CheckCircle';
import RadioButtonUncheckedIcon from '@material-ui/icons/RadioButtonUnchecked';
import { ButtonIcon, Card, Flex, Tooltip, TooltipTrigger } from '@backstage/ui';

import '@backstage/ui/css/styles.css';

type Props = {
  total: number | undefined;
  completed: number | undefined;
  standards: PagerDutyServiceStandard[] | undefined;
  compact?: boolean;
};

export function colorFromPercentage(theme: Theme, percentage: number) {
  if (percentage < 0.5) {
    return theme.palette.error.main;
  } else if (percentage < 0.8) {
    return theme.palette.warning.main;
  }
  return theme.palette.success.main;
}

function ServiceStandardsCard({ total, completed, standards, compact }: Props) {
  const useStyles = makeStyles<BackstageTheme>(theme => ({
    cardStyle: {
      height: compact !== true ? '120px' : '80px',
      padding: 0,
      position: 'relative',
      backgroundColor: 'rgba(0, 0, 0, 0.03)',
    },
    largeTextStyle: {
      fontSize: compact !== true ? '50px' : '40px',
      color:
        completed !== undefined && total !== undefined
          ? colorFromPercentage(theme, completed / total)
          : colorFromPercentage(theme, 0),
      alignSelf: 'center',
      justifyContent: 'center',
    },
    smallTextStyle: {
      color: theme.palette.textSubtle,
      fontSize: compact !== true ? '14px' : '12px',
      fontWeight: 'bold',
      alignSelf: 'center',
      marginLeft: '-20px',
      marginBottom: '-20px',
    },
    tooltipIcon: {
      marginRight: '5px',
    },
    infoIcon: {
      color: 'gray',
      '&:hover': {
        backgroundColor: 'transparent',
      },
    },
    standardItem: {
      display: 'flex',
      alignItems: 'center',
    },
    linearProgressContainer: {
      left: 0,
      position: 'absolute',
      bottom: 0,
      width: '100%',
      padding: '0px',
    },
    textContainerStyle: {
      position: 'absolute',
      top: compact ? '5px' : '20px',
      width: '100%',
    },
    tooltipTriggerStyles: {
      position: 'relative',
      zIndex: 1,
    },
  }));

  const BorderLinearProgress = withStyles(theme => ({
    root: {
      height: 10,
      borderRadius: 5,
      margin: 5,
    },
    colorPrimary: {
      backgroundColor:
        theme.palette.grey[theme.palette.type === 'light' ? 200 : 700],
    },
    bar: {
      borderRadius: 5,
      backgroundColor:
        completed !== undefined && total !== undefined
          ? colorFromPercentage(theme, completed / total)
          : colorFromPercentage(theme, 0),
    },
  }))(LinearProgress);

  const {
    cardStyle,
    largeTextStyle,
    smallTextStyle,
    linearProgressContainer,
    tooltipIcon,
    textContainerStyle,
    infoIcon,
    standardItem,
    tooltipTriggerStyles,
  } = useStyles();

  if (
    standards === undefined ||
    completed === undefined ||
    total === undefined
  ) {
    return (
      <Card className={cardStyle}>
        <Flex justify="center">
          <Typography className={smallTextStyle}>
            Unable to retrieve Scores
          </Typography>
        </Flex>
      </Card>
    );
  }

  return (
    <Card className={cardStyle}>
      <Flex direction="column">
        <TooltipTrigger>
          <ButtonIcon
            className={tooltipTriggerStyles}
            icon={<InfoIcon className={infoIcon} />}
            variant="tertiary"
          />
          <Tooltip>
            {standards?.map((standard, key) => (
              <Typography key={key}>
                {standard.pass ? (
                  <Typography className={standardItem}>
                    <CheckCircle className={tooltipIcon} /> {standard.name}
                  </Typography>
                ) : (
                  <Typography className={standardItem}>
                    <RadioButtonUncheckedIcon className={tooltipIcon} />{' '}
                    {standard.name}
                  </Typography>
                )}
              </Typography>
            ))}
          </Tooltip>
        </TooltipTrigger>
        <Flex justify="center" className={textContainerStyle}>
          <Typography className={largeTextStyle}>{completed}</Typography>
          <Typography className={smallTextStyle}>/{total}</Typography>
        </Flex>
        <div className={linearProgressContainer}>
          <BorderLinearProgress
            variant="determinate"
            value={(completed! / total!) * 100}
          />
        </div>
      </Flex>
    </Card>
  );
}

export default ServiceStandardsCard;
