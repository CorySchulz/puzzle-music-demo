import LibraryView from './views/Library.pzl';
import ArtistView from './views/Artist.pzl';
import ArtistIndexChild from './views/ArtistIndexChild.pzl';
import ArtistInfoDialog from './views/ArtistInfoDialog.pzl';
import AlbumView from './views/Album.pzl';
import SearchView from './views/Search.pzl';
import LikedView from './views/Liked.pzl';
import PlaylistView from './views/Playlist.pzl';
import NowPlayingView from './views/NowPlaying.pzl';
import NotFoundView from './views/NotFound.pzl';

import AppLayout from './layouts/AppLayout.pzl';
import PlayerLayout from './layouts/PlayerLayout.pzl';

// Two layouts on purpose (constellation/doc/DOC-SPEC.md §12, D28):
//   • Library / Artist / Album / Search / 404 all share AppLayout, so navigating
//     between them is a "view swap inside a reused layout" — the sidebar and the
//     persistent MiniPlayer stay mounted, only the <Slot/> animates.
//   • /now-playing rides a DIFFERENT layout (PlayerLayout). Routing to it is a
//     layout SWAP: the whole shell animates out as a unit and the full-screen
//     player animates in. Routing back swaps them the other way.
export default [
  { path: '/',            name: 'library',     view: LibraryView,    layout: AppLayout,    meta: { title: 'Your Library · Puzzle Sounds' } },
  // Artist gains an overlay child (v1.3 nested routes, D30): the ArtistView stays
  // mounted (its Info button survives) while ArtistInfoDialog swaps into <Slot/>,
  // the shape the router-driven morph needs (D55). Relative child paths; the
  // parent keeps its layout + name.
  {
    path: '/artist/:id', name: 'artist', view: ArtistView, layout: AppLayout, meta: { title: 'Artist · Puzzle Sounds' },
    children: [
      { path: '',     name: 'artist-index', view: ArtistIndexChild },
      { path: 'info', name: 'artist-info',  view: ArtistInfoDialog, meta: { title: 'Artist Info · Puzzle Sounds' } },
    ],
  },
  { path: '/album/:id',   name: 'album',       view: AlbumView,      layout: AppLayout,    meta: { title: 'Album · Puzzle Sounds' } },
  { path: '/search',      name: 'search',      view: SearchView,     layout: AppLayout,    meta: { title: 'Search · Puzzle Sounds' } },
  { path: '/liked',       name: 'liked',       view: LikedView,      layout: AppLayout,    meta: { title: 'Liked Songs · Puzzle Sounds' } },
  { path: '/playlist/:id',name: 'playlist',    view: PlaylistView,   layout: AppLayout,    meta: { title: 'Playlist · Puzzle Sounds' } },
  { path: '/now-playing', name: 'now-playing', view: NowPlayingView, layout: PlayerLayout, meta: { title: 'Now Playing · Puzzle Sounds' } },
  { path: '*',            name: 'not-found',   view: NotFoundView,   layout: AppLayout,    meta: { title: 'Not Found · Puzzle Sounds' } },
];
