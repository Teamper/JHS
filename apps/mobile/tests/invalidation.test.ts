import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import { subscribeInvalidation } from '../src/data/queries/invalidation.ts';
import { queryKeys as keys } from '../src/data/queries/queryKeys.ts';
import { DomainEventEmitter, publishStorageEvent } from '../src/data/workspace/DomainEventEmitter.ts';

test('workspace changes invalidate their own keys and keep the public catalog and unrelated work cached', () => {
  const client = new QueryClient();
  const events = new DomainEventEmitter();
  const unsubscribe = subscribeInvalidation(events, client);
  const catalog = keys.catalog({ source: 'sample', section: 'latest', text: '' });
  const detail = keys.detail({ source: 'sample', id: 'one', carNum: 'JHS-001' });
  const first = keys.movie('JHS-001');
  const second = keys.movie('JHS-002');
  const library = keys.libraryPage({ text: '', flags: ['watched'], sort: 'code' });
  const entries = [catalog, detail, first, second, library, keys.summary, keys.follow, keys.settings, keys.cloud, keys.activity, keys.sync];
  const invalidated = () => entries.filter(key => client.getQueryState(key)?.isInvalidated);

  try {
    for (const key of entries) client.setQueryData(key, {});
    publishStorageEvent(events, 'car-state-changed', { carNums: ['JHS-001'] });
    publishStorageEvent(events, 'activity-log-changed', {});
    assert.deepEqual(invalidated(), [first, library, keys.summary, keys.activity]);
    publishStorageEvent(events, 'offline-history-changed', {});
    assert.deepEqual(invalidated(), [first, library, keys.summary, keys.cloud, keys.activity]);
    events.emit({ domain: 'settings', keys: ['theme'] });
    events.emit({ domain: 'follow' });
    events.emit({ domain: 'sync' });
    assert.deepEqual(invalidated(), entries.slice(2).filter(key => key !== second));
    events.emit({ domain: 'reset' });
    assert.deepEqual(invalidated(), entries.slice(2));

    unsubscribe();
    client.setQueryData(keys.follow, { restored: true });
    events.emit({ domain: 'follow' });
    assert.equal(client.getQueryState(keys.follow)?.isInvalidated, false);
  } finally { client.clear(); }
});
