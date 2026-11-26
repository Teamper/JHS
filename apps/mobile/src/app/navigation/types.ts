import type { ActorRef, Movie, MovieRef } from '../../data/models/movie.ts';

export type Routes = {
  Home: undefined;
  Work: MovieRef;
  Settings: undefined;
  Sync: undefined;
  Backup: undefined;
  Activity: undefined;
  Accounts: undefined;
  Cloud: undefined;
  RemoteLists: { movies: Movie[] };
  FavoriteActors: undefined;
  ActorWorks: ActorRef;
  Gallery: { images: string[]; index: number };
};

export type Tabs = { Discover: undefined; Follow: undefined; Library: undefined; Mine: undefined };
