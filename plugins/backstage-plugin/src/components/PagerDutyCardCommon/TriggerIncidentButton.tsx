/*
 * Copyright 2021 The Backstage Authors
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

// eslint-disable-next-line @backstage/no-undeclared-imports
import { useCallback, useState } from 'react';
import { makeStyles, Typography } from '@material-ui/core';
import { BackstageTheme } from '@backstage/theme';

import { TriggerDialog } from '../TriggerDialog';
import AddAlert from '@material-ui/icons/AddAlert';
import { ButtonIcon } from '@backstage/ui';

/** @public */
export type TriggerIncidentButtonProps = {
  integrationKey: string | undefined;
  entityName: string;
  compact?: boolean;
  handleRefresh: () => void;
};

/** @public */
export function TriggerIncidentButton({
  integrationKey,
  entityName,
  compact,
  handleRefresh,
}: TriggerIncidentButtonProps) {
  const useStyles = makeStyles<BackstageTheme>(() => ({
    containerStyle: {
      fontSize: compact !== true ? '12px' : '10px',
      width: compact !== true ? '80px' : '60px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    },

    textStyle: {
      textAlign: 'center',
    },
  }));

  const { containerStyle, textStyle } = useStyles();
  const [dialogShown, setDialogShown] = useState<boolean>(false);

  const showDialog = useCallback(() => {
    setDialogShown(true);
  }, [setDialogShown]);
  const hideDialog = useCallback(() => {
    setDialogShown(false);
  }, [setDialogShown]);

  const disabled = !integrationKey;

  return (
    <>
      <div className={containerStyle}>
        <ButtonIcon
          variant="tertiary"
          size="medium"
          aria-label="create-incident"
          onClick={showDialog}
          isDisabled={disabled}
          icon={<AddAlert />}
        />

        <Typography className={textStyle}>Create new incident</Typography>
      </div>
      {integrationKey && (
        <TriggerDialog
          showDialog={dialogShown}
          handleDialog={hideDialog}
          integrationKey={integrationKey}
          serviceName={entityName}
          onIncidentCreated={handleRefresh}
        />
      )}
    </>
  );
}
