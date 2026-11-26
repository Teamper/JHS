import type { QueryClient } from '@tanstack/react-query';
import type { DomainEventEmitter } from '../workspace/DomainEventEmitter.ts';
import { queryKeys as keys } from './queryKeys.ts';

export function subscribeInvalidation(events: DomainEventEmitter, client: QueryClient) {
  const invalidate = (queryKey: readonly unknown[], exact = true) => { void client.invalidateQueries({ queryKey, exact }); };
  return events.subscribe(event => {
    switch (event.domain) {
      case 'movie':
        if (event.carNums?.length) for (const id of event.carNums) invalidate(keys.movie(id));
        else invalidate(keys.movies, false);
        invalidate(keys.library, false);
        invalidate(keys.summary);
        invalidate(keys.visibility);
        break;
      case 'follow': invalidate(keys.follow); invalidate(keys.actors); break;
      case 'visibility': invalidate(keys.visibility); break;
      case 'recent': invalidate(keys.recent); break;
      case 'settings': invalidate(keys.settings); break;
      case 'activity': invalidate(event.kind === 'history' ? keys.activity : keys.cloud); break;
      case 'sync': invalidate(keys.sync); break;
      case 'reset': invalidate(keys.workspace, false); break;
    }
  });
}
