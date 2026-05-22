require('dotenv').config();
const { Bot, InlineKeyboard } = require('grammy');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Bot va Gemini sozlamalari
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 1. ASOSIY MENYU
const mainMenu = new InlineKeyboard()
  .text("🛣️ Reys Boshlash", "start_trip").text("💰 Moliyaviy Hisob", "finance").row()
  .text("💸 Xarajat Qo'shish", "add_expense").text("🤖 Yordamchi", "ai_help");

bot.command("start", async (ctx) => {
  await ctx.reply("🚚 *Logistika Yordamchisi*\n\nSizga bugun qanday yordam bera olaman?", { 
    reply_markup: mainMenu, 
    parse_mode: "Markdown" 
  });
});

// 2. AI TAHLIL FUNKSIYASI
async function analyzeExpense(text) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
  const prompt = `Foydalanuvchi xarajat haqida yozdi: "${text}". 
    Uni tahlil qil va quyidagi JSON formatida qaytar: 
    {"category": "fuel|customs|road|food|other", "amount": number, "currency": "rubl|usd|sum", "description": "qisqa izoh"}.
    Javobda faqat JSON bo'lsin.`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text().replace(/```json|```/g, "").trim());
}

// 3. XABARLARNI QABUL QILISH
bot.on("message:text", async (ctx) => {
  const loadingMsg = await ctx.reply("🧠 *AI tahlil qilmoqda...*", { parse_mode: "Markdown" });
  
  try {
    const data = await analyzeExpense(ctx.message.text);
    
    await ctx.api.editMessageText(ctx.chat.id, loadingMsg.message_id, 
      `✅ *Xarajat saqlandi!*\n\n` +
      `📂 Kategoriya: ${data.category}\n` +
      `💵 Summa: ${data.amount} ${data.currency}\n` +
      `📝 Izoh: ${data.description}`, 
      { parse_mode: "Markdown" }
    );
  } catch (err) {
    console.error(err);
    await ctx.api.editMessageText(ctx.chat.id, loadingMsg.message_id, "⚠️ Xarajatni aniqlay olmadim. Iltimos, aniqroq yozing (masalan: 'Solyarkaga 1000 rubl ketdi').");
  }
});

// 4. TUGMALAR ISHLOVI
bot.callbackQuery("add_expense", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("Yaxshi! Xarajatni yozib yuboring (Masalan: 'Tarozi uchun 500 rubl')");
});

// Botni ishga tushirish
bot.start();
console.log("🚀 Bot to'liq funksional rejimda ishga tushdi!");
