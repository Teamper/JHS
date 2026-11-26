export type WorkspaceEvent =
  | { domain: 'movie'; carNums?: readonly string[] }
  | { domain: 'follow' }
  | { domain: 'visibility' | 'recent' }
  | { domain: 'settings'; keys: readonly string[] }
  | { domain: 'activity'; kind: 'history' | 'cloud' }
  | { domain: 'sync' }
  | { domain: 'reset' };

type Listener = (event: WorkspaceEvent) => void;

export class DomainEventEmitter {
  private readonly listeners = new Set<Listener>();

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  emit(event: WorkspaceEvent) {
    for (const listener of this.listeners) listener(event);
  }
}

type StorageNotice = { carNums?: readonly string[]; changedDomains?: readonly string[]; scope?: 'items' | 'all' };

export function publishStorageEvent(events: DomainEventEmitter, type: string, notice: StorageNotice) {
  switch (type) {
    case 'car-state-changed':
      if (notice.changedDomains && !notice.changedDomains.includes('car_list')) break;
      events.emit({ domain: 'movie', carNums: notice.scope === 'all' ? undefined : notice.carNums });
      break;
    case 'car-records-removed':
    case 'personal-rating-changed':
      events.emit({ domain: 'movie', carNums: notice.carNums });
      break;
    case 'blacklist-rules-changed':
    case 'filter-rules-changed':
      events.emit({ domain: 'visibility' });
      break;
    case 'actress-changed':
    case 'new-video-changed':
      events.emit({ domain: 'follow' });
      break;
    case 'activity-log-changed':
      events.emit({ domain: 'activity', kind: 'history' });
      break;
    case 'offline-history-changed':
      events.emit({ domain: 'activity', kind: 'cloud' });
      break;
  }
}
