import {
  AuthService,
  DiscoveryService,
  LoggerService,
} from '@backstage/backend-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { PagerDutyClient } from '../apis/client';
import { PagerDutyCustomFieldsProcessor } from './PagerDutyCustomFieldsProcessor';

jest.mock('../apis/client');

const MockedPagerDutyClient = PagerDutyClient as jest.MockedClass<
  typeof PagerDutyClient
>;

const location: LocationSpec = {
  type: 'url',
  target: 'https://example.com/catalog-info.yaml',
};

const emit = jest.fn();

const componentEntity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'my-service',
    annotations: {
      'pagerduty.com/service-id': 'PSERVICE',
    },
  },
  spec: { type: 'service' },
};

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(),
} as unknown as LoggerService;

function buildProcessor() {
  return new PagerDutyCustomFieldsProcessor({
    logger,
    discovery: {} as DiscoveryService,
    auth: {} as AuthService,
  });
}

describe('PagerDutyCustomFieldsProcessor', () => {
  let mockClient: jest.Mocked<PagerDutyClient>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not push when the data sync is disabled', async () => {
    const processor = buildProcessor();
    mockClient = MockedPagerDutyClient.mock
      .instances[0] as jest.Mocked<PagerDutyClient>;
    mockClient.isDataSyncEnabled.mockResolvedValue(false);
    mockClient.getEnabledCustomFields.mockResolvedValue([]);
    mockClient.pushCustomFieldValues.mockResolvedValue(undefined as never);

    await processor.postProcessEntity(componentEntity, location, emit);

    expect(mockClient.isDataSyncEnabled).toHaveBeenCalledTimes(1);
    expect(mockClient.getEnabledCustomFields).not.toHaveBeenCalled();
    expect(mockClient.pushCustomFieldValues).not.toHaveBeenCalled();
  });

  it('pushes values when the data sync is enabled', async () => {
    const processor = buildProcessor();
    mockClient = MockedPagerDutyClient.mock
      .instances[0] as jest.Mocked<PagerDutyClient>;
    mockClient.isDataSyncEnabled.mockResolvedValue(true);
    mockClient.getEnabledCustomFields.mockResolvedValue([
      {
        pagerdutyCustomFieldId: 'CF1',
        pagerdutyCustomFieldDisplayName: 'Tier',
        backstageEntityMappingPath: 'metadata.name',
      } as never,
    ]);
    mockClient.pushCustomFieldValues.mockResolvedValue(undefined as never);

    await processor.postProcessEntity(componentEntity, location, emit);

    expect(mockClient.isDataSyncEnabled).toHaveBeenCalledTimes(1);
    expect(mockClient.getEnabledCustomFields).toHaveBeenCalledTimes(1);
    expect(mockClient.pushCustomFieldValues).toHaveBeenCalledWith(
      'PSERVICE',
      [{ id: 'CF1', value: 'my-service' }],
      undefined,
    );
  });

  it('skips non-Component entities before checking the data sync', async () => {
    const processor = buildProcessor();
    mockClient = MockedPagerDutyClient.mock
      .instances[0] as jest.Mocked<PagerDutyClient>;

    const apiEntity: Entity = { ...componentEntity, kind: 'API' };
    await processor.postProcessEntity(apiEntity, location, emit);

    expect(mockClient.isDataSyncEnabled).not.toHaveBeenCalled();
  });
});
