import { Store } from "./db.js";
import { getQuestion, questionsFor } from "./questions.js";
import { makeId, makeInviteToken, percent } from "./utils.js";
import type { Category, Game } from "./types.js";

export class GameService {
  constructor(private store: Store, private botUsername: string) {}

  create(creatorId:number,category:Category): Game {
    const qs=questionsFor(category);
    const game:Game={id:makeId("g"),creatorId,category,inviteToken:makeInviteToken(),status:"CREATING",currentQuestion:0,createdAt:Date.now(),expiresAt:Date.now()+1000*60*60*24*3};
    this.store.createGame(game,qs.map(q=>q.id));
    return game;
  }

  getQuestions(game:any) { return JSON.parse(game.question_ids) as string[]; }
  question(game:any,index:number) { return getQuestion(this.getQuestions(game)[index]); }
  inviteUrl(token:string) { return `https://t.me/${this.botUsername}?start=game_${token}`; }

  saveCreatorAnswer(game:any,userId:number,questionId:string,answer:number) {
    if(game.creator_id!==userId || game.status!=="CREATING") throw new Error("NOT_ALLOWED");
    this.store.addCreatorAnswer(game.id,questionId,answer);
    const next=game.current_question+1;
    if(next>=10) { this.store.creatorCompleted(game.id); return {done:true}; }
    this.store.setCurrent(game.id,next);
    return {done:false,next};
  }

  join(token:string,userId:number) {
    const game=this.store.getGameByToken(token);
    if(!game || game.expires_at<Date.now() || game.status==="COMPLETED") throw new Error("INVALID_GAME");
    if(game.creator_id===userId) throw new Error("CREATOR_CANNOT_PLAY");
    this.store.joinGame(game.id,userId);
    this.store.setStatus(game.id,"PLAYING");
    return game;
  }

  guess(game:any,userId:number,questionId:string,selected:number) {
    const player=this.store.getPlayer(game.id,userId);
    if(!player || player.role!=="guesser" || game.status!=="PLAYING") throw new Error("NOT_ALLOWED");
    if(this.store.hasGuess(game.id,questionId,userId)) throw new Error("ALREADY_ANSWERED");
    const actual=this.store.getCreatorAnswer(game.id,questionId);
    if(!actual) throw new Error("QUESTION_NOT_READY");
    const correct=actual.answer===selected;
    this.store.addGuess(game.id,questionId,userId,selected,correct);
    const stats=this.store.getGuesserStats(game.id,userId);
    return {correct,total:Number(stats.total),done:Number(stats.total)>=10,score:percent(Number(stats.correct),Number(stats.total))};
  }
}
