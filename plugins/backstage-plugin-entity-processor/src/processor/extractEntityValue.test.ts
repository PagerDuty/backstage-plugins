import { Entity } from '@backstage/catalog-model';
import { extractValueAtPath } from './extractEntityValue';

const entity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'my-service',
    namespace: 'default',
    description: 'My service',
    annotations: {
      'pagerduty.com/service-id': 'PXXX',
      'backstage.io/source-location': 'url:https://example.com',
    },
    tags: ['team-a', 'go'],
  },
  spec: {
    type: 'service',
    owner: 'team-a',
    lifecycle: 'production',
  },
};

describe('extractValueAtPath', () => {
  it('returns dot-path values as strings', () => {
    expect(extractValueAtPath(entity, 'metadata.name')).toEqual({
      ok: true,
      value: 'my-service',
    });
    expect(extractValueAtPath(entity, 'spec.owner')).toEqual({
      ok: true,
      value: 'team-a',
    });
  });

  it('supports bracket notation for keys with dots', () => {
    expect(
      extractValueAtPath(
        entity,
        'metadata.annotations["pagerduty.com/service-id"]',
      ),
    ).toEqual({ ok: true, value: 'PXXX' });
  });

  it('supports single-quoted bracket notation', () => {
    expect(
      extractValueAtPath(
        entity,
        "metadata.annotations['backstage.io/source-location']",
      ),
    ).toEqual({ ok: true, value: 'url:https://example.com' });
  });

  it('supports unquoted bracket notation', () => {
    expect(extractValueAtPath(entity, 'metadata[name]')).toEqual({
      ok: true,
      value: 'my-service',
    });
  });

  it('coerces non-string scalars to string', () => {
    const e = {
      ...entity,
      metadata: { ...entity.metadata, count: 42 } as unknown as Entity['metadata'],
    };
    expect(extractValueAtPath(e, 'metadata.count')).toEqual({
      ok: true,
      value: '42',
    });
  });

  it('returns not-ok when path resolves to undefined', () => {
    const result = extractValueAtPath(entity, 'metadata.missing');
    expect(result.ok).toBe(false);
  });

  it('returns not-ok when traversing into a missing intermediate', () => {
    const result = extractValueAtPath(entity, 'metadata.nope.deeper');
    expect(result.ok).toBe(false);
  });

  it('returns not-ok when path resolves to an object', () => {
    const result = extractValueAtPath(entity, 'metadata.annotations');
    expect(result.ok).toBe(false);
  });

  it('returns not-ok when path resolves to an array', () => {
    const result = extractValueAtPath(entity, 'metadata.tags');
    expect(result.ok).toBe(false);
  });

  it('returns not-ok for empty/invalid paths', () => {
    expect(extractValueAtPath(entity, '').ok).toBe(false);
    expect(extractValueAtPath(entity, '[]').ok).toBe(false);
    expect(extractValueAtPath(entity, 'metadata[unterminated').ok).toBe(false);
  });
});
