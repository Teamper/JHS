import { fromByteArray } from 'base64-js';
import { artwork, collections, works } from '@jhs/fixtures';
import { movieRecord, type ActorRef, type Movie } from './movie.ts';

function sampleArtwork(...input: Parameters<typeof artwork>) {
  const uri = artwork(...input);
  const svg = decodeURIComponent(uri.slice(uri.indexOf(',') + 1));
  // The native image loader expects the data URI body to be Base64.
  return `data:image/svg+xml;base64,${fromByteArray(new TextEncoder().encode(svg))}`;
}

export const sampleCast: ActorRef[] = [...new Set(works.flatMap(work => work.actors))].map((name, index) => ({
  id: 'sample-' + (index + 1), name, source: 'sample',
}));

export const sampleMovies: Movie[] = works.map((work, index) => ({
  id: work.id,
  source: 'sample',
  carNum: `JHS-${String(index + 1).padStart(3, '0')}`,
  title: work.title,
  url: `https://example.invalid/works/${index + 1}`,
  coverUrl: work.cover ? sampleArtwork(work) : undefined,
  actors: work.actors,
  cast: sampleCast.filter(actor => work.actors.includes(actor.name)),
  releaseDate: work.releaseDate,
  rating: work.ratingValue ?? undefined,
  voteCount: work.voteCount ?? undefined,
  fields: [{ label: '发行日期', value: work.releaseDate }, { label: '片长', value: work.duration + ' 分钟' }],
  images: Array.from({ length: work.stills }, (_, variant) => sampleArtwork(work, 'cover', variant + 1)),
}));

export function sampleLibrary(count = 16) {
  return Array.from({ length: count }, (_, index) => {
    const movie = sampleMovies[index % sampleMovies.length]!;
    return {
      ...movieRecord(movie), carNum: `JHS-${String(index + 1).padStart(3, '0')}`, coverUrl: undefined,
      title: index < sampleMovies.length ? movie.title : `${movie.title} ${index + 1}`,
      updateDate: new Date(Date.UTC(2026, 0, 24, 0, -index)).toISOString(),
      collectionMembership: Object.fromEntries(Object.entries(collections).filter(([, list]) => list.members.some(member => member === index)).map(([id]) => [id, true])),
      stateFlags: { favorite: index > 0 && index % 3 === 0, watched: index > 0 && index % 4 === 0, downloaded: index % 4 === 1, blocked: false },
    };
  });
}

export const sampleActors = [{
  starId: 'sample-1', name: '林夏', newVideoList: sampleMovies.slice(0, 7).map(movie => ({
    carNum: movie.carNum, title: movie.title, url: movie.url, publishTime: movie.releaseDate,
  })),
}, {
  starId: 'sample-2', name: '许舟', newVideoList: sampleMovies.slice(5, 11).map(movie => ({
    carNum: movie.carNum, title: movie.title, url: movie.url, publishTime: movie.releaseDate,
  })),
}];
