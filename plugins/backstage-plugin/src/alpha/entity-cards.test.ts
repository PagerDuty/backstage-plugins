import { pagerDutyEntityCard, pagerDutyEntitySmallCard } from './entity-cards';

function getConfigSchema(extension: unknown) {
  return (
    extension as {
      configSchema: { parse: (input: unknown) => unknown };
    }
  ).configSchema;
}

describe('PagerDuty entity card configuration', () => {
  it('supports configuration for the full entity card', () => {
    const configSchema = getConfigSchema(pagerDutyEntityCard);

    expect(configSchema).toBeDefined();
    expect(
      configSchema.parse({
        readOnly: true,
        disableChangeEvents: true,
        disableOnCall: true,
      }),
    ).toEqual({
      readOnly: true,
      disableChangeEvents: true,
      disableOnCall: true,
    });
  });

  it('supports configuration for the small entity card', () => {
    const configSchema = getConfigSchema(pagerDutyEntitySmallCard);

    expect(configSchema).toBeDefined();
    expect(
      configSchema.parse({
        readOnly: true,
        disableOnCall: true,
        disableInsights: true,
      }),
    ).toEqual({
      readOnly: true,
      disableOnCall: true,
      disableInsights: true,
    });
  });
});
