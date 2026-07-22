import { PuzzleModel, Puzzle } from '@magic-spells/puzzle';

export default class Track extends PuzzleModel {
  static schema = {
    id:          Puzzle.string().primary(),
    title:       Puzzle.string().required(),
    albumId:     Puzzle.string().required(),
    artistId:    Puzzle.string().required(),
    trackNo:     Puzzle.number().min(1),
    durationSec: Puzzle.number().required(),
    plays:       Puzzle.number().default(0),
    liked:       Puzzle.boolean().default(false),
  };

  // Toggle the like flag. app.js persists liked ids to localStorage, so a model
  // method keeps that one mutation in a single, testable place.
  toggleLike() {
    return this.update({ liked: !this.liked });
  }

  static adapter = {
    endpoint: '/tracks.json',
  };
}
