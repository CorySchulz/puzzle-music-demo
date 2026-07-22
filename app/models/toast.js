import { PuzzleModel, Puzzle } from '@magic-spells/puzzle';

// A single local-only toast record (id: 'main') — exactly the Player/Playlist
// pattern (models/player.js): it declares NO adapter. It is created at boot and
// mutated in the store, never fetched. Because it lives in the store, the Toast
// component (components/Toast.pzl) auto-subscribes and re-renders whenever any
// surface calls show(); call sites just do
// `store.findMany('toast')[0].show('…')`.
export default class Toast extends PuzzleModel {
  static schema = {
    id:      Puzzle.string().primary(),
    message: Puzzle.string().default(''),
    // Bumped on every show() so two identical messages in a row still register
    // as a distinct notification (the component keys its dismiss timer on it).
    nonce:   Puzzle.number().default(0),
  };

  // Flash a message. Bumping nonce guarantees a state change even when the text
  // is unchanged, so the component re-shows and restarts its auto-dismiss timer.
  show(message) {
    return this.update({ message, nonce: this.nonce + 1 });
  }
}
