require('dotenv').config();
const { Bot, InlineKeyboard } = require('grammy');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Bot va Gemini instansiyalarini yaratish
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Asosiy menyu klaviaturasi
const mainMenuKeyboard = new InlineKeyboard()
  .text("🛣️ Reys Boshqaruvi", "menu_trips").text("💰 Moliyaviy Hisob", "menu_finance").row()
  .text("💸 Xarajatlar Kiritish", "menu_expenses").text("🤖 AI Aqlli Yordamchi", "menu_ai").row()
  .text("📊 Joriy Statistika", "menu_stats");

bot.command("start", async (ctx) => {
  await ctx.reply("🚚 *Logistika botiga xush kelibsiz!*", { 
    reply_markup: mainMenuKeyboard, 
    parse_mode: "Markdown" 
  });
});

// Gemini orqali matnni tahlil qilish
bot.on("message:text", async (ctx) => {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const userText = ctx.message.text;

  try {
    const prompt = `Sen logistika yordamchisisan. Foydalanuvchi xarajat haqida yozadi: "${userText}". 
    Uni tahlil qilib, quyidagi JSON formatida qaytar: {"category": "...", "amount": 0, "currency": "...", "description": "..."}.
    Kategoriyalar: fuel, customs, road, maintenance, food. Hech qanday izoh qo'shma, faqat JSON qaytar.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, "").trim();
    const data = JSON.parse(text);

    await ctx.reply(`✅ *Xarajat qabul qilindi!*\n\n📂 Kategoriya: ${data.category}\n💵 Summa: ${data.amount} ${data.currency}\n📝 Izoh: ${data.description}`, { parse_mode: "Markdown" });
  } catch (err) {
    console.error(err);
    await ctx.reply("⚠️ AI tahlil qilishda xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.");
  }
});

// Render uchun botni ishga tushirish
bot.start();
console.log("🚀 Bot Gemini 1.5 Flash tizimida muvaffaqiyatli ishga tushdi!");
