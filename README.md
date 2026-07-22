# Puzzle Sounds

A Spotify-style music app built with the
[Puzzle framework](https://github.com/magic-spells/puzzle) — browse a library of
6 artists / 12 albums / 48 tracks, dig into artist and album pages, build
playlists, heart songs into Liked Songs, search across everything, and drive a
persistent playback bar that expands into a full-screen player. It's a showcase
for **layout swaps, view transition animations, skeleton loading, and a
store-backed player** whose state (likes, playlists, queue, volume, last
position) all survives a reload. Everything is local — no backend, no image
assets (every piece of "artwork" is a two-stop CSS gradient off a record's
`accent`).

Dark player chrome, one violet accent, near-black background — familiar without
pretending to be the real thing.

## Run it

```bash
npm install
npm run dev      # watch + rebuild + live-reload dev server
npm run build    # production build → dist/
```

## Deploy

The repo ships a `vercel.json` that tells Vercel to run `npm run build` and
serve the `dist/` folder. Import the repo into Vercel and it deploys as-is —
the `puzzle` CLI installs from npm with a prebuilt Linux binary, so the build
runs fine on Vercel's machines.

Because the app runs in **hash mode**, the built `dist/` hosts on any static
host — GitHub Pages, S3, `file://` — with **zero rewrite rules**: the route
rides in `location.hash` (`…/index.html#/album/x`), so the server only ever
serves `index.html` and the flat seed JSON next to it.

## What it showcases

| Feature in the app | Framework surface |
| --- | --- |
| Route in `location.hash`, static-host friendly | **Hash routing** — `routerMode: 'hash'` (SPEC §15, D34) |
| Home / Artist / Album paint a skeleton, then swap in real data | **Skeleton loading** — `<puzzle-skeleton>` + async `data()` (SPEC §16, D39); the store itself is seeded in the app's `beforeMount` hook (SPEC §30, D60) |
| Icon set picks its glyph by name; repeat button picks its icon by mode | **`{#case}` / `{:when}`** multi-branch (D37) |
| Time-of-day greeting on Home (night / morning / afternoon / evening) | **`{:else if}` chaining** (D40) |
| AlbumCard's hover play button plays without following the card link | **Event modifiers** `@click:prevent:stop` (D38) |
| Search clears on Escape; playlist title saves on Enter / cancels on Escape | **Key-filter modifiers** `@keydown:escape`, `@keydown:enter` (D38) |
| Full-screen player slides up over the shell; views cross-fade on nav | **View + layout transition animations** (sequential, one animator per swap; SPEC §12, D28) |
| Artist "Info" button grows into a centered dialog and flies back on close (back/forward too); Queue button morphs into the modal queue | **Shared-element morph** — router-driven `enableMorph` + `data-puzzle-morph` over a nested route, plus a hand-driven `MorphEngine` for the local-state queue (SPEC §12, D55) |
| Album / artist card grids cascade in; equalizer bars ripple | **Per-instance staggered enters** via `get animations()` + a `delay` keyed on the loop counter |
| `{#for track in tracks, i}`, `{#for 1...5, i}` | **Loop counters** (D29) |
| Player, toast, and playlists live only in the store (never fetched) | **Local-only store records** — no adapter, created at boot |
| Liking a song anywhere lights it up in Liked Songs and the row instantly | **Reactive store subscriptions** — `findMany({ filter })` re-runs `data()` |
| `m:ss` durations, compacted play counts, pluralized labels | **Formatters** with args (`duration`, `compact`, `plural`) |
| Scroll resets to top on nav, restores on back/forward | **Router scroll behavior** (default; D33) |
| Likes / playlists / session snapshot survive reloads | **localStorage persistence pattern** — one key, saved on `visibilitychange` / `beforeunload` |
| Spotify-style accent bleed at the top of album / artist / playlist / liked / player pages | Per-record `accent` gradient (`Puzzle.object()`) → low-alpha header glow computed in `data()` |

## Morph dialogs

The app shows the **two ways** a Puzzle app opens a shared-element morph — a
surface that visibly grows out of the control that triggered it and shrinks back
into it on close (`@magic-spells/morph-engine` under the hood).

**Artist Info — router-driven.** The Artist page's ghost **Info** button and the
`/artist/:id/info` dialog carry the same `data-puzzle-morph="artist-info-…"`
value. One line at boot wires it up:

```js
import { enableMorph } from '@magic-spells/puzzle/morph';
// … after new PuzzleApp({ … })
enableMorph(app);           // pairs data-puzzle-morph elements across route swaps
```

`/artist/:id` gains an overlay **child route** (`{ path: 'info', view:
ArtistInfoDialog }`), so pushing it keeps `Artist.pzl` mounted and swaps the
dialog into its `<Slot/>` — the button survives for the router to morph into the
dialog and, on close, fly back home. Because it's route-driven, the **browser
back button morphs too**, and `/artist/:id/info` is a real deep link (the initial
navigation renders the dialog plain — nothing to morph from yet). The dialog is a
non-modal `<dialog open>` (not `showModal()`): the modal top layer would paint
over the morph blob. There is **zero morph code in the view** — it just declares
the shared attribute and navigates.

**Card art — also router-driven, directional.** The very same `enableMorph`
covers the album and artist card art flying into the detail page's big header
art, spelled with the directional attributes (D69): each card art is a
**trigger** (`data-puzzle-morph-trigger="album-{ id }"`) and the matching
`Album`/`Artist` header art is the **target**
(`data-puzzle-morph-target="album-{ id }"`). Clicking the card (a plain
`<a href>` hash link) morphs the card art into the header art, settling with
the same spring physics. This is a *sibling* view swap — the source view and
its card are gone before the detail view mounts — but the router captures the
leaving element automatically at the route's **leave phase** and pairs it with
the incoming one (D68). Trigger→target pairs are **forward-only**: a trigger
launches but never receives, a target receives but never launches, so going
back shows the grid plainly. (Symmetric surfaces that should round-trip — like
the Info dialog above — use plain `data-puzzle-morph` on both ends instead; and
when the same id appears twice in the arriving view, a `-target` beats a plain
element for the landing.) Like the dialog, there is **zero morph code in the
cards** — they just declare the attribute; the `<a>` navigates and the router
does the rest.

**Queue — hand-driven.** The Queue panel morphs out of the MiniPlayer's Queue
button too, but it's toggled by **local layout state**, not a route — which the
router integration deliberately doesn't cover. So `QueueDialog.pzl` runs its own
`MorphEngine` by hand, promoting the `<dialog>` to a true modal with
`showModal()` mid-flight (at the engine's `reveal` point, while it's still
invisible) for a seam-free handoff. It uses a plain `data-morph` attribute, not
`data-puzzle-morph`, precisely to stay invisible to `enableMorph`.

`prefers-reduced-motion` disables the flight in both paths (the panels and
artwork just appear); `@magic-spells/morph-engine` is an optional peer
dependency — an app that imports none of these paths bundles none of it.

## App structure

```
app/
├── app.js              # PuzzleApp config (hash mode, formatters) + parallel seed in beforeMount (D60)
├── routes.js           # 8 flat routes across two layouts (AppLayout vs PlayerLayout)
├── storage.js          # localStorage load/save (one key: puzzle-sounds/v1)
├── models/
│   ├── index.js        # model registry
│   ├── artist.js       # accent gradient, initials/artwork getters (JSON adapter)
│   ├── album.js        # accent, era getter (JSON adapter)
│   ├── track.js        # liked flag + toggleLike (JSON adapter)
│   ├── playlist.js     # local-only: ordered trackIds, rename/add/removeTrack
│   ├── player.js       # local-only session: play/next/prev, shuffle/repeat, queue, seek
│   └── toast.js        # local-only: single message + nonce for auto-dismiss
├── layouts/
│   ├── AppLayout.pzl   # sidebar + mobile tab bar + MiniPlayer + queue + toast; global key shortcuts
│   └── PlayerLayout.pzl# full-screen player chrome (a layout SWAP away from AppLayout)
├── views/
│   ├── Library.pzl     # Home: greeting, quick picks, recently played, artist/album grids
│   ├── Artist.pzl      # header glow, popular tracks, album grid; "Info" morph button + <Slot/>
│   ├── ArtistIndexChild.pzl # empty index leaf for /artist/:id (fills the Slot when no dialog)
│   ├── ArtistInfoDialog.pzl # /artist/:id/info overlay: router-morphed dialog (D55)
│   ├── Album.pzl       # header glow, track list
│   ├── Playlist.pzl    # header glow, inline rename, remove/delete
│   ├── Liked.pzl       # fixed-violet Liked Songs collection
│   ├── Search.pzl      # live artist/album/song search from local query state
│   ├── NowPlaying.pzl  # full-screen player: seek, volume, shuffle/repeat, owns the tick while visible
│   └── NotFound.pzl    # catch-all 404
├── components/
│   ├── Icon.pzl        # inline-SVG icon set, glyph chosen with {#case}
│   ├── AlbumCard.pzl   # grid card with the D38 hover play button
│   ├── ArtistCard.pzl  # circular avatar card, staggered enter
│   ├── TrackRow.pzl    # one row: play/like + kebab menu (queue + add-to-playlist + navigate)
│   ├── MiniPlayer.pzl  # persistent bar; owns the 1s tick everywhere but /now-playing
│   ├── QueueDialog.pzl # centered modal queue; morphs out of the MiniPlayer's Queue button
│   ├── Toast.pzl       # global pill, nonce-keyed auto-dismiss
│   ├── EqualizerBars.pzl# now-playing visualizer, rippling bars
│   └── Button.pzl      # reusable pill button, label via <Slot/>
└── public/
    ├── index.html      # mount target
    └── artists.json / albums.json / tracks.json   # flat seed data (D21 read path)
```

## Persistence & hosting

Everything the user changes — liked tracks, created/renamed/deleted playlists,
and the playback session (current track, position, volume, shuffle/repeat mode,
queue, and recently-played albums) — is snapshotted into a single localStorage
key (`puzzle-sounds/v1`) on `visibilitychange` and `beforeunload`, and restored
during the boot seed. Playback never auto-resumes: the session is re-cued where
you left it, but stays paused until you press play.

Because the route lives in the URL hash, the production `dist/` is a fully
static bundle — drop it on any host with no server-side routing and every deep
link (`#/album/…`, `#/playlist/…`) works.
