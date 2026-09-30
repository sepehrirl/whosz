import { Bot, InlineKeyboard, type Context } from "grammy";
import type { GameService } from "./game.js";
import { getQuestion } from "./questions.js";
import type { Category } from "./types.js";
import { Store } from "./db.js";

const categories: {key:Category;label:string}[]=[
  {key:"fun",label:"😂 فان"},{key:"mind",label:"🧠 شناختی"},{key:"friendship",label:"🫂 رفاقتی"},{key:"random",label:"🎲 تصادفی"}
];

function mainMenu(){
  return new InlineKeyboard()
    .text("🎮 بازی جدید","new").row()
    .text("👥 بازی‌های من","games").text("🏆 رتبه من","rank").row()
    .text("📊 آمار من","stats").text("❓ راهنما","help");
}

async function safeEdit(ctx:Context,text:string,keyboard?:InlineKeyboard){
  try { await ctx.editMessageText(text,{reply_markup:keyboard}); } catch { await ctx.reply(text,{reply_markup:keyboard}); }
}

export function createBot(token:string,store:Store,service:GameService){
  const bot=new Bot(token);

  bot.command("start",async ctx=>{
    if(ctx.from) store.upsertUser({id:ctx.from.id,username:ctx.from.username,firstName:ctx.from.first_name});
    const payload=ctx.match.trim();
    if(payload.startsWith("game_")){
      try{
        const game=service.join(payload.slice(5),ctx.from!.id);
        const q=service.question(game,0)!;
        const kb=new InlineKeyboard();
        q.options.forEach((o,i)=>kb.text(o,`guess:${game.id}:${q.id}:${i}`).row());
        await ctx.reply(`👀 یک بازی WHOZ برات ساخته شده!\n\nسؤال 1/10\n\n${q.text}`,{reply_markup:kb});
      }catch(e){
        const code=e instanceof Error?e.message:"";
        await ctx.reply(code==="CREATOR_CANNOT_PLAY"?"این بازی برای خودته 😄":"این لینک بازی نامعتبر یا منقضی شده است.");
      }
      return;
    }
    await ctx.reply("🧠 WHOZ\n\nفکر می‌کنی دوستات واقعاً چقدر تو رو می‌شناسن؟ 👀",{reply_markup:mainMenu()});
  });

  bot.callbackQuery("new",async ctx=>{
    await ctx.answerCallbackQuery();
    const kb=new InlineKeyboard();
    categories.forEach(c=>kb.text(c.label,`cat:${c.key}`).row());
    await safeEdit(ctx,"🎮 چه مدل بازی‌ای می‌خوای؟",{...kb});
  });

  bot.callbackQuery(/^cat:(.+)$/,async ctx=>{
    await ctx.answerCallbackQuery();
    const category=ctx.match[1] as Category;
    const game=service.create(ctx.from.id,category);
    const q=service.question(store.getGame(game.id),0)!;
    const kb=new InlineKeyboard();
    q.options.forEach((o,i)=>kb.text(o,`creator:${game.id}:${q.id}:${i}`).row());
    await safeEdit(ctx,`🎯 بازی ساخته شد!\n\nسؤال 1/10\n${q.text}`,kb);
  });

  bot.callbackQuery(/^creator:([^:]+):([^:]+):(\d+)$/,async ctx=>{
    await ctx.answerCallbackQuery();
    const [,gameId,qid,opt]=ctx.match;
    try{
      const result=service.saveCreatorAnswer(store.getGame(gameId),ctx.from.id,qid,Number(opt));
      if(result.done){
        const game=store.getGame(gameId);
        await safeEdit(ctx,`🔥 همه جواب‌ها ثبت شد!\n\nحالا لینک رو برای دوستت بفرست:\n\n${service.inviteUrl(game.invite_token)}`,new InlineKeyboard().url("📤 اشتراک بازی",`https://t.me/share/url?url=${encodeURIComponent(service.inviteUrl(game.invite_token))}&text=${encodeURIComponent("فکر می‌کنی چقدر منو می‌شناسی؟ 👀")}`).row().text("🏠 منوی اصلی","home"));
      }else{
        const game=store.getGame(gameId); const q=service.question(game,result.next!)!;
        const kb=new InlineKeyboard(); q.options.forEach((o,i)=>kb.text(o,`creator:${game.id}:${q.id}:${i}`).row());
        await safeEdit(ctx,`سؤال ${result.next!+1}/10\n\n${q.text}`,kb);
      }
    }catch{ await ctx.reply("این سؤال دیگر فعال نیست."); }
  });

  bot.callbackQuery(/^guess:([^:]+):([^:]+):(\d+)$/,async ctx=>{
    await ctx.answerCallbackQuery();
    const [,gameId,qid,opt]=ctx.match;
    try{
      const result=service.guess(store.getGame(gameId),ctx.from.id,qid,Number(opt));
      if(result.done){
        store.completePlayer(gameId,ctx.from.id,result.score);
        store.setStatus(gameId,"COMPLETED");
        const game=store.getGame(gameId);
        const creator=store.getUser(game.creator_id);
        const text=`🏆 نتیجه WHOZ\n\nتو ${creator?.first_name ?? "دوستت"} رو ${result.score}% می‌شناسی!\n\n✅ درست: ${result.total===0?0:Math.round(result.score/10)} از 10\n\n${result.score>=80?"🔥 خیلی خوبه!":result.score>=50?"😎 بد نیست!":"😂 باید بیشتر باهم بگردین!"}`;
        const share=`https://t.me/share/url?url=${encodeURIComponent(service.inviteUrl(game.invite_token))}&text=${encodeURIComponent("من توی WHOZ امتیاز "+result.score+"٪ گرفتم. حالا تو امتحانم کن 👀")}`;
        await safeEdit(ctx,text,new InlineKeyboard().url("📤 اشتراک نتیجه",share).text("🎯 منو هم امتحان کن","new").row().text("🏠 خانه","home"));
      }else{
        const game=store.getGame(gameId); const q=service.question(game,result.total)!;
        const kb=new InlineKeyboard(); q!.options.forEach((o,i)=>kb.text(o,`guess:${game.id}:${q!.id}:${i}`).row());
        await safeEdit(ctx,`${result.correct?"✅ درست بود!":"❌ اشتباه!"}\n\nسؤال ${result.total+1}/10\n\n${q!.text}`,kb);
      }
    }catch(e){
      await ctx.reply(e instanceof Error && e.message==="ALREADY_ANSWERED"?"این سؤال رو قبلاً جواب دادی 😄":"این بازی دیگه قابل ادامه نیست.");
    }
  });

  bot.callbackQuery("stats",async ctx=>{await ctx.answerCallbackQuery();const s=store.getStats(ctx.from.id);await safeEdit(ctx,`📊 آمار تو\n\n🎮 بازی ساخته‌شده: ${s?.games_created??0}\n🧠 بازی انجام‌شده: ${s?.games_played??0}\n✅ جواب‌های درست: ${s?.total_correct??0}\n🎯 کل حدس‌ها: ${s?.total_guesses??0}`,new InlineKeyboard().text("🏠 خانه","home"));});
  bot.callbackQuery("help",async ctx=>{await ctx.answerCallbackQuery();await safeEdit(ctx,"❓ چطور بازی کنیم؟\n\n1. بازی جدید بساز.\n2. به ۱۰ سؤال درباره خودت جواب بده.\n3. لینک رو برای دوستت بفرست.\n4. دوستت حدس می‌زنه.\n5. نتیجه رو ببین و برای نفر بعدی چالش بساز! 🔥",new InlineKeyboard().text("🏠 خانه","home"));});
  bot.callbackQuery("home",async ctx=>{await ctx.answerCallbackQuery();await safeEdit(ctx,"🧠 WHOZ\n\nفکر می‌کنی دوستات واقعاً چقدر تو رو می‌شناسن؟ 👀",mainMenu());});
  bot.callbackQuery("games",async ctx=>{await ctx.answerCallbackQuery();await ctx.reply("👥 مدیریت بازی‌ها در V1.1 اضافه می‌شود.");});
  bot.callbackQuery("rank",async ctx=>{await ctx.answerCallbackQuery();await ctx.reply("🏆 رتبه‌بندی عمومی در V1.1 اضافه می‌شود.");});

  bot.catch(err=>console.error("WHOZ error:",err.error));
  return bot;
}
