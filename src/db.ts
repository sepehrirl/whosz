import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Category, Game, GameStatus } from "./types.js";

export class Store {
  private db: Database.Database;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER UNIQUE NOT NULL,
        username TEXT,
        first_name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        games_created INTEGER NOT NULL DEFAULT 0,
        games_played INTEGER NOT NULL DEFAULT 0,
        total_correct INTEGER NOT NULL DEFAULT 0,
        total_guesses INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        creator_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        invite_token TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL,
        current_question INTEGER NOT NULL DEFAULT 0,
        question_ids TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS creator_answers (
        game_id TEXT NOT NULL,
        question_id TEXT NOT NULL,
        answer INTEGER NOT NULL,
        PRIMARY KEY(game_id, question_id)
      );
      CREATE TABLE IF NOT EXISTS players (
        game_id TEXT NOT NULL,
        telegram_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        score INTEGER NOT NULL DEFAULT 0,
        completed_at INTEGER,
        PRIMARY KEY(game_id, telegram_id)
      );
      CREATE TABLE IF NOT EXISTS guesses (
        game_id TEXT NOT NULL,
        question_id TEXT NOT NULL,
        telegram_id INTEGER NOT NULL,
        selected INTEGER NOT NULL,
        correct INTEGER NOT NULL,
        PRIMARY KEY(game_id, question_id, telegram_id)
      );
      CREATE INDEX IF NOT EXISTS idx_games_invite ON games(invite_token);
      CREATE INDEX IF NOT EXISTS idx_games_creator ON games(creator_id);
    `);
  }

  upsertUser(user: {id:number; username?:string; firstName:string}) {
    const now = Date.now();
    this.db.prepare(`INSERT INTO users(telegram_id,username,first_name,created_at,last_seen_at)
      VALUES(?,?,?,?,?)
      ON CONFLICT(telegram_id) DO UPDATE SET username=excluded.username,first_name=excluded.first_name,last_seen_at=excluded.last_seen_at`)
      .run(user.id, user.username ?? null, user.firstName, now, now);
  }

  getUser(id:number) {
    return this.db.prepare("SELECT * FROM users WHERE telegram_id=?").get(id) as any;
  }

  createGame(game: Game, questionIds: string[]) {
    const tx = this.db.transaction(() => {
      this.db.prepare("INSERT INTO games VALUES(?,?,?,?,?,?,?,?,?)")
        .run(game.id,game.creatorId,game.category,game.inviteToken,game.status,0,JSON.stringify(questionIds),game.createdAt,game.expiresAt);
      this.db.prepare("INSERT INTO players(game_id,telegram_id,role) VALUES(?,?,?)").run(game.id,game.creatorId,"creator");
      this.db.prepare("UPDATE users SET games_created=games_created+1 WHERE telegram_id=?").run(game.creatorId);
    });
    tx();
  }

  getGame(id:string): any {
    return this.db.prepare("SELECT * FROM games WHERE id=?").get(id);
  }

  getGameByToken(token:string): any {
    return this.db.prepare("SELECT * FROM games WHERE invite_token=?").get(token);
  }

  setStatus(id:string,status:GameStatus) { this.db.prepare("UPDATE games SET status=? WHERE id=?").run(status,id); }
  setCurrent(id:string,index:number) { this.db.prepare("UPDATE games SET current_question=? WHERE id=?").run(index,id); }

  addCreatorAnswer(gameId:string,questionId:string,answer:number) {
    this.db.prepare("INSERT OR REPLACE INTO creator_answers VALUES(?,?,?)").run(gameId,questionId,answer);
  }

  getCreatorAnswer(gameId:string,questionId:string): any {
    return this.db.prepare("SELECT answer FROM creator_answers WHERE game_id=? AND question_id=?").get(gameId,questionId);
  }

  joinGame(gameId:string,telegramId:number) {
    this.db.prepare("INSERT OR IGNORE INTO players(game_id,telegram_id,role) VALUES(?,?,?)").run(gameId,telegramId,"guesser");
  }

  getPlayer(gameId:string,telegramId:number): any {
    return this.db.prepare("SELECT * FROM players WHERE game_id=? AND telegram_id=?").get(gameId,telegramId);
  }

  addGuess(gameId:string,questionId:string,telegramId:number,selected:number,correct:boolean) {
    this.db.prepare("INSERT INTO guesses VALUES(?,?,?,?,?)").run(gameId,questionId,telegramId,selected,correct?1:0);
  }

  hasGuess(gameId:string,questionId:string,telegramId:number): boolean {
    return !!this.db.prepare("SELECT 1 FROM guesses WHERE game_id=? AND question_id=? AND telegram_id=?").get(gameId,questionId,telegramId);
  }

  getGuesserStats(gameId:string,telegramId:number) {
    return this.db.prepare("SELECT COUNT(*) total,SUM(correct) correct FROM guesses WHERE game_id=? AND telegram_id=?").get(gameId,telegramId) as any;
  }

  completePlayer(gameId:string,telegramId:number,score:number) {
    const now=Date.now();
    this.db.prepare("UPDATE players SET score=?,completed_at=? WHERE game_id=? AND telegram_id=?").run(score,now,gameId,telegramId);
    this.db.prepare("UPDATE users SET games_played=games_played+1,total_correct=total_correct+?,total_guesses=total_guesses+10 WHERE telegram_id=?").run(Math.round(score/10),telegramId);
  }

  creatorCompleted(gameId:string) {
    this.db.prepare("UPDATE games SET status='WAITING' WHERE id=?").run(gameId);
  }

  getStats(id:number) {
    return this.db.prepare("SELECT games_created,games_played,total_correct,total_guesses FROM users WHERE telegram_id=?").get(id) as any;
  }

  close() { this.db.close(); }
}
