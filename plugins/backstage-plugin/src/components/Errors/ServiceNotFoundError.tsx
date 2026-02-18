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
// eslint-disable-next-line @backstage/no-undeclared-imports
import { useState, useEffect } from 'react';
import {
  Button as MuiButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Link,
  CircularProgress,
  useTheme,
  Box,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { EmptyState } from '@backstage/core-components';
import { Entity } from '@backstage/catalog-model';
import { useApi, alertApiRef } from '@backstage/core-plugin-api';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import { Button } from '@backstage/ui';

export interface ServiceNotFoundErrorProps {
  entity: Entity;
  onUnmap?: () => Promise<boolean>;
  serviceId?: string;
  integrationKey?: string;
}

export const ServiceNotFoundError = ({
  entity,
  onUnmap,
  serviceId,
  integrationKey,
}: ServiceNotFoundErrorProps) => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const alertApi = useApi(alertApiRef);
  const theme = useTheme();

  const [{ value, loading, error }, handleUnmap] = useAsyncFn(async () => {
    return await onUnmap?.();
  }, [onUnmap]);

  useEffect(() => {
    if (value !== undefined) {
      (async () => {
        alertApi.post({
          message: 'Service successfully unmapped',
        });

        setShowConfirmDialog(false);

        await new Promise(resolve => setTimeout(resolve, 1000));
        window.location.reload();
      })();
    }
  }, [value, alertApi, setShowConfirmDialog]);

  useEffect(() => {
    if (error) {
      alertApi.post({
        message: `Failed to unmap service. ${error.message}`,
        severity: 'error',
      });
    }
  }, [error, alertApi]);

  return (
    <>
      <EmptyState
        missing="data"
        title="PagerDuty Service Not Found"
        description="A service could not be found within PagerDuty based on the provided service id. Please verify your configuration."
        action={
          <Box display="flex" flexWrap="wrap" style={{ gap: 12 }}>
            {onUnmap && (
              <MuiButton
                color="secondary"
                variant="contained"
                onClick={() => setShowConfirmDialog(true)}
              >
                Unmap Service
              </MuiButton>
            )}
            <MuiButton
              color="primary"
              variant="contained"
              href="https://pagerduty.github.io/backstage-plugin-docs/getting-started/pagerduty/"
            >
              Read More
            </MuiButton>
          </Box>
        }
      />

      <Dialog
        open={showConfirmDialog}
        onClose={() => !loading && setShowConfirmDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Unmap PagerDuty Service?</DialogTitle>
        <DialogContent>
          <Alert severity="info">
            <Typography variant="body1" align="justify">
              If this is a temporary issue or the service still exists in
              PagerDuty, please verify the service ID in your entity
              configuration before unmapping. If the service has been
              permanently deleted or renamed, unmapping will allow you to
              create a new mapping to the correct service.
            </Typography>
          </Alert>
          <Typography
            variant="body1"
            style={{ marginTop: '1em' }}
            gutterBottom
            align="justify"
          >
            This will remove the PagerDuty service mapping for{' '}
            <strong>{entity?.metadata.name || 'this entity'}</strong>.
          </Typography>
          {(serviceId || integrationKey) && (
            <Alert severity="warning" style={{ marginTop: '1em' }}>
              <Typography variant="body2">
                {serviceId && (
                  <>
                    <strong>Service ID:</strong> {serviceId}
                    <br />
                  </>
                )}
                {integrationKey && (
                  <>
                    <strong>Integration Key:</strong> {integrationKey}
                  </>
                )}
              </Typography>
            </Alert>
          )}
          <Typography
            variant="body1"
            style={{ marginTop: '1em' }}
            gutterBottom
            align="justify"
          >
            After unmapping, you can create a new mapping from the{' '}
            <Link href="/pagerduty">PagerDuty admin page</Link>.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            data-testid="unmap-button"
            id="unmap"
            style={{
              background: loading
                ? theme.palette.action.disabled
                : theme.palette.secondary.main,
            }}
            isDisabled={loading}
            variant="primary"
            onClick={handleUnmap}
            iconEnd={loading ? <CircularProgress size={16} /> : <></>}
          >
            {loading ? 'UNMAPPING' : 'UNMAP SERVICE'}
          </Button>
          <Button id="close" onClick={() => setShowConfirmDialog(false)}>
            CLOSE
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
