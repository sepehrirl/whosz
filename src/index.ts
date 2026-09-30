import "dotenv/config";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Store } from "./db.js";
import { GameService } from "./game.js";
import { createBot } from "./bot.js";

const token=process.env.BOT_TOKEN;
const username=process.env.BOT_USERNAME;
const dbPath=process.env.DATABASE_PATH ?? "./data/whosz.db";

if(!token || !username){
  console.error("Missing BOT_TOKEN or BOT_USERNAME in .env");
  process.exit(1);
}

mkdirSync(dirname(dbPath),{recursive:true});
const store=new Store(dbPath);
const service=new GameService(store,username);
const bot=createBot(token,store,service);

await bot.api.setMyCommands([
  {command:"start",description:"شروع WHOZ"},
]);

console.log("WHOZ is running.");
await bot.start();
