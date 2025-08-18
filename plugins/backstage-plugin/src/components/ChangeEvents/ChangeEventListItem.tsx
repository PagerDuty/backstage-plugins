/*
 * Copyright 2020 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  makeStyles,
  Typography,
} from '@material-ui/core';
import { ButtonIcon, Tooltip, TooltipTrigger } from '@backstage/ui';
import { DateTime, Duration } from 'luxon';
import { PagerDutyChangeEvent } from '@pagerduty/backstage-plugin-common';
import OpenInBrowserIcon from '@material-ui/icons/OpenInBrowser';
import LinkIcon from '@material-ui/icons/Link';
import { BackstageTheme } from '@backstage/theme';

const useStyles = makeStyles<BackstageTheme>(theme => ({
  denseListIcon: {
    marginRight: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listItemPrimary: {
    fontWeight: 'bold',
  },
  smallIconStyle: {
    color: theme.palette.text.primary,
  },
}));

type Props = {
  changeEvent: PagerDutyChangeEvent;
};

export const ChangeEventListItem = ({ changeEvent }: Props) => {
  const classes = useStyles();
  const duration =
    new Date().getTime() - new Date(changeEvent.timestamp).getTime();
  const changedAt = DateTime.local()
    .minus(Duration.fromMillis(duration))
    .toRelative({ locale: 'en' });

  const handleExternalLinkClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handlePagerDutyClick = () => {
    if (changeEvent.html_url) {
      window.open(changeEvent.html_url, '_blank', 'noopener,noreferrer');
    }
  };

  let externalLinkElem: JSX.Element | undefined;
  if (changeEvent.links.length > 0 && changeEvent.links[0]?.href) {
    const text: string = changeEvent.links[0].text;
    const linkHref = changeEvent.links[0].href;
    externalLinkElem = (
      <TooltipTrigger>
        <ButtonIcon
          icon={<LinkIcon className={classes.smallIconStyle} />}
          variant="tertiary"
          onClick={() => handleExternalLinkClick(linkHref)}
        />
        <Tooltip>{text}</Tooltip>
      </TooltipTrigger>
    );
  }

  return (
    <ListItem dense key={changeEvent.id}>
      <ListItemText
        primary={<>{changeEvent.summary}</>}
        primaryTypographyProps={{
          variant: 'body1',
          className: classes.listItemPrimary,
        }}
        secondary={
          <Typography variant="body2" color="textSecondary">
            Triggered from {changeEvent.source} {changedAt}.
          </Typography>
        }
      />
      <ListItemSecondaryAction>
        {externalLinkElem}
        {changeEvent.html_url === undefined ? null : (
          <TooltipTrigger>
            <ButtonIcon
              aria-label="view-in-pd-button"
              icon={<OpenInBrowserIcon className={classes.smallIconStyle} />}
              variant="tertiary"
              onClick={handlePagerDutyClick}
            />
            <Tooltip>View in PagerDuty</Tooltip>
          </TooltipTrigger>
        )}
      </ListItemSecondaryAction>
    </ListItem>
  );
};
