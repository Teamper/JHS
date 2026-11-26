import type { CatalogQuery } from '../catalog/CatalogSource.ts';
import type { LibraryQuery, MovieRef } from '../models/movie.ts';

const workspace = ['workspace'] as const;
const movies = [...workspace, 'movie'] as const;
const library = [...workspace, 'library'] as const;

export const queryKeys = {
  workspace,
  movies,
  library,
  catalogs: ['catalog', 'list'] as const,
  catalog: (query: Omit<CatalogQuery, 'page'>) => ['catalog', 'list', query] as const,
  detail: (ref: MovieRef) => ['catalog', 'detail', ref.source, ref.id, ref.carNum, ref.seed?.url] as const,
  actor: (source: string, id: string) => ['catalog', 'actor', source, id] as const,
  movie: (carNum: string | null) => [...movies, carNum] as const,
  libraryPage: (query: Omit<LibraryQuery, 'offset'>) => [...library, { ...query, flags: [...query.flags].sort() }] as const,
  follow: [...workspace, 'follow'] as const,
  actors: [...workspace, 'actors'] as const,
  visibility: [...workspace, 'visibility'] as const,
  recent: [...workspace, 'recent'] as const,
  summary: [...workspace, 'summary'] as const,
  settings: [...workspace, 'settings'] as const,
  activity: [...workspace, 'activity'] as const,
  cloud: [...workspace, 'cloud'] as const,
  sync: [...workspace, 'sync'] as const,
};
