import { PuzzleModel, Puzzle } from '@magic-spells/puzzle';

export default class Track extends PuzzleModel {
  static schema = {
    id:          Puzzle.string().primary(),
    title:       Puzzle.string().required(),
    albumId:     Puzzle.string().required(),
    artistId:    Puzzle.string().required(),
    trackNo:     Puzzle.number().min(1),
    durationSec: Puzzle.number().required(),
    // Root-relative path to the track's mp3 (served flat from the site root, same
    // as /tracks.json). audio.js reads it to set the shared <audio> element's src.
    audioUrl:    Puzzle.string().default(''),
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
