import type { Query, QueryClient } from '@tanstack/react-query';

export async function refreshJavDbCatalog(client: QueryClient, firstLogin: boolean) {
  const related = ({ queryKey: [domain, , source] }: Query) => {
    const id = typeof source === 'object' && source && 'source' in source ? source.source : source;
    return domain === 'catalog' && (id === 'javdb' || id === 'fc2');
  };
  // The discovery screen resumes its failed next page using the public pages it already loaded.
  const keepPages = (query: Query) => firstLogin && query.queryKey[1] === 'list' && query.state.data !== undefined;
  await Promise.all([
    client.resetQueries({ predicate: query => related(query) && !keepPages(query) }),
    client.invalidateQueries({ predicate: query => related(query) && keepPages(query), refetchType: 'none' }),
  ]);
}
