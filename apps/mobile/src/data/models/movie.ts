import { getMovieStateEligibility, normalizeMovieCarNum, legacyActionToFlag, normalizeStateFlags } from '@jhs/core';

export const flags = { favorite: '收藏', downloaded: '已下载', watched: '已看', blocked: '屏蔽' } as const;
export type MovieFlag = keyof typeof flags;
export type Source = 'javdb' | 'javbus' | 'fc2' | 'sample';
export type ActorRef = { id: string; source: 'javdb' | 'javbus' | 'sample'; name: string; url?: string; coverUrl?: string };
export type ActorProfile = ActorRef & { names: readonly string[]; actressType?: string };
export type MovieActor = Omit<ActorRef, 'id'> & { id: string | null };
export type Magnet = { uri: string; name: string; meta: string; subtitle: boolean };
export function actorKey(actor: ActorRef) {
  return actor.source === 'javbus' ? 'javbus:' + actor.id : actor.id;
}
export function savedActorRef(starId: string, name: string, coverUrl?: string): ActorRef {
  if (starId.startsWith('javbus:')) return { id: starId.slice(7), source: 'javbus', name, coverUrl };
  return { id: starId, source: starId.startsWith('sample-') ? 'sample' : 'javdb', name, coverUrl };
}

export type Movie = {
  id: string;
  source: Source;
  carNum: string | null;
  title: string;
  url?: string;
  coverUrl?: string;
  releaseDate?: string;
  actors?: string[];
  cast?: MovieActor[];
  rating?: number;
  voteCount?: number;
  subtitle?: boolean;
  fields?: { label: string; value: string }[];
  magnets?: Magnet[];
  related?: Movie[];
  remark?: string;
  trailer?: string;
  trailerPoster?: string;
  previewRequest?: { url: string; token: string };
  images?: string[];
  stills?: { url: string; thumbnail: string | null }[];
  stateFlags?: Record<MovieFlag, boolean>;
  stateEligibility?: ReturnType<typeof getMovieStateEligibility>;
};

type MovieSeed = Pick<Movie, 'url' | 'title' | 'coverUrl' | 'releaseDate' | 'actors' | 'rating' | 'stateEligibility'>;

export type MovieRef = Pick<Movie, 'source' | 'id' | 'carNum'> & { seed?: MovieSeed };

export function movieRef({ source, id, carNum, title, url, coverUrl, releaseDate, actors, rating, stateEligibility }: Movie): MovieRef {
  return { source, id, carNum, seed: { title, url, coverUrl, releaseDate, actors, rating, stateEligibility } };
}

export function movieFromRef({ source, id, carNum, seed }: MovieRef): Movie {
  return { source, id, carNum, title: carNum ?? id, ...seed };
}

export type LibraryQuery = {
  text: string;
  flags: MovieFlag[];
  sort: 'updated' | 'date' | 'code';
  collection?: string;
  includeCount?: boolean;
  offset?: number;
};

export const pageSize = 40;
export const flagBits: Record<MovieFlag, number> = { favorite: 1, downloaded: 2, watched: 4, blocked: 8 };

export function recordMovie(row: Record<string, unknown>, id: number): Movie {
  const text = (value: unknown) => typeof value === 'string' && value.trim() ? value : undefined;
  const url = text(row.url);
  const source = url?.includes('javbus') ? 'javbus' : url?.includes('123av') ? 'fc2'
    : url?.startsWith('https://example.invalid/') ? 'sample' : 'javdb';
  const carNum = normalizeMovieCarNum(row.carNum);
  const legacy = legacyActionToFlag(row.status);
  const stateFlags = normalizeStateFlags((row.stateFlags ?? (legacy && { [legacy]: true })) as Movie['stateFlags']);
  return {
    id: `saved:${id}`, source, carNum, url,
    title: text(row.title) ?? text(row.names) ?? carNum ?? '未识别的作品',
    coverUrl: text(row.coverUrl), releaseDate: text(row.releaseDate) ?? text(row.publishTime),
    actors: Array.isArray(row.actorNames) ? row.actorNames.filter((name): name is string => typeof name === 'string')
      : text(row.actorNames)?.split(/[、,，]/u),
    remark: text(row.remark), stateFlags,
    stateEligibility: getMovieStateEligibility(row),
  };
}

export function movieRecord(movie: Movie) {
  return {
    carNum: movie.carNum,
    url: movie.url,
    names: movie.title,
    title: movie.title,
    coverUrl: movie.coverUrl,
    publishTime: movie.releaseDate,
    actorNames: movie.actors,
    stateEligibility: movie.stateEligibility,
  };
}
