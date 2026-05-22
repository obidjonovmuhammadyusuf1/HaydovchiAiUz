require('dotenv').config();
const { Bot, InlineKeyboard } = require('grammy');
const { OpenAI } = require('openai');

// 1. Bot va Hugging Face (OpenAI moslashuvchan) instansiyalarini yaratish
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || "https://api-inference.huggingface.co/v1"
});

// 2. KLAVIATURALAR TIZIMI
const mainMenuKeyboard = new InlineKeyboard()
  .text("🛣️ Reys Boshqaruvi", "menu_trips").text("💰 Moliyaviy Hisob", "menu_finance").row()
  .text("💸 Xarajatlar Kiritish", "menu_expenses").text("🤖 AI Aqlli Yordamchi", "menu_ai").row()
  .text("📊 Joriy Statistika", "menu_stats").text("⚙️ Sozlamalar", "menu_settings");

const tripsMenuKeyboard = new InlineKeyboard()
  .text("🟢 Yangi Reys Ochish", "trip_new").row()
  .text("🟡 Faol Reysni Ko'rish", "trip_active").row()
  .text("🔴 Reysni Yakunlash", "trip_end").row()
  .text("⬅️ Orqaga", "menu_main");

const expensesMenuKeyboard = new InlineKeyboard()
  .text("⛽ Yoqilg'i (Solyarka)", "exp_fuel").text("🛂 Bojxona", "exp_customs").row()
  .text("🛠️ Zapchast / Remont", "exp_maintenance").text("🛣️ Patrik/Tarozi", "exp_road").row()
  .text("🍔 Shofyor Ovqati", "exp_food").text("⬅️ Orqaga", "menu_main");

const backButton = new InlineKeyboard().text("⬅️ Orqaga", "menu_main");

// 3. KOMANDALAR VA TUGMALAR ISHLOVCHILARI
bot.command("start", async (ctx) => {
  try {
    await ctx.reply(
      `🚚 *Logistika va Reys Yordamchisi* botiga xush kelibsiz!\n\n` +
      `Menga yo'ldagi xarajatlaringizni erkin matn ko'rinishida yozib yuborishingiz mumkin. Bepul Llama-3 AI tizimi uni tahlil qiladi.\n\n` +
      `*Masalan:* _"Solyarkaga 10400 rubl berdim"_\n\n` +
      `Yoki quyidagi tugmalardan birini tanlang:`,
      { reply_markup: mainMenuKeyboard, parse_mode: "Markdown" }
    );
  } catch (err) { console.error("Start xatosi:", err); }
});

bot.callbackQuery("menu_main", async (ctx) => {
  try {
    await ctx.editMessageText("🚚 Quyidagi menyulardan birini tanlang:", { reply_markup: mainMenuKeyboard });
    await ctx.answerCallbackQuery();
  } catch (err) { console.error(err); }
});

bot.callbackQuery("menu_trips", async (ctx) => {
  try {
    await ctx.editMessageText("🛣️ *Reys Boshqaruvi Bo'limi*", { reply_markup: tripsMenuKeyboard, parse_mode: "Markdown" });
    await ctx.answerCallbackQuery();
  } catch (err) { console.error(err); }
});

bot.callbackQuery("menu_expenses", async (ctx) => {
  try {
    await ctx.editMessageText("💸 *Xarajatlarni Kiritish*", { reply_markup: expensesMenuKeyboard, parse_mode: "Markdown" });
    await ctx.answerCallbackQuery();
  } catch (err) { console.error(err); }
});

bot.callbackQuery("menu_ai", async (ctx) => {
  try {
    await ctx.editMessageText("🤖 *AI Aqlli Yordamchi*\n\nMenga xarajatlaringizni yozib yuboring (Masalan: 'Solyarka 10400 rubl'). Tizim uni avtomatik ajratib beradi.", { reply_markup: backButton, parse_mode: "Markdown" });
    await ctx.answerCallbackQuery();
  } catch (err) { console.error(err); }
});

const remainingButtons = [
  "menu_finance", "menu_stats", "menu_settings", 
  "trip_new", "trip_active", "trip_end", 
  "exp_fuel", "exp_customs", "exp_maintenance", "exp_road", "exp_food"
];
remainingButtons.forEach(buttonId => {
  bot.callbackQuery(buttonId, async (ctx) => {
    try {
      let txt = "Ushbu bo'lim tez orada bazaga ulanadi.";
      if (buttonId.startsWith("exp_")) txt = "Kategoriya tanlandi! Endi summani yozib yuborishingiz mumkin.";
      await ctx.editMessageText(`ℹ️ *Xabar:* ${txt}`, { reply_markup: backButton, parse_mode: "Markdown" });
      await ctx.answerCallbackQuery();
    } catch (err) { console.error(err); }
  });
});

// 4. HUGGING FACE (LLAMA-3) MATNNI TAHLIL QILISH MODULI
bot.on("message:text", async (ctx) => {
  const userText = ctx.message.text;
  let waitingMsg;

  try {
    waitingMsg = await ctx.reply("🧠 _AI xabaringizni tahlil qilmoqda..._", { parse_mode: "Markdown" });

    // Hugging Face bepul API orqali Llama-3 modeliga so'rov yuborish
    const completion = await openai.chat.completions.create({
      model: "meta-llama/Meta-Llama-3-8B-Instruct",
      messages: [
        {
          role: "system",
          content: `Sen logistika tizimi uchun ma'lumotlarni saralovchi yordamchisan. 
          Foydalanuvchi yuborgan matndan faqat summa (amount), valyuta (currency) va kategoriyani aniqlashing kerak.
          Kategoriyalar faqat quyidagilardan biri bo'lishi mumkin: 'fuel', 'customs', 'road_fees', 'maintenance', 'food_living', 'other'.
          Javobni FAQAT toza JSON formatida ber, hech qanday markdown belgilari (\`\`\`json kabi) yoki boshqa tushuntirish mutqalo qo'shma.
          Format namunasi: {"status": "success", "category": "fuel", "amount": 10400, "currency": "rubl", "description": "Solyarka xarajati"}`
        },
        {
          role: "user",
          content: userText
        }
      ],
      temperature: 0.1,
      max_tokens: 200
    });

    let aiResponse = completion.choices[0].message.content.trim();
    
    // Matndagi har qanday ortiqcha json belgilari yoki tozalash ishlari
    aiResponse = aiResponse.replace(/```json/gi, '').replace(/```/g, '').trim();

    const parsedData = JSON.parse(aiResponse);

    if (waitingMsg) {
      await ctx.api.deleteMessage(ctx.chat.id, waitingMsg.message_id).catch(() => {});
    }

    if (parsedData.amount) {
      const categoryIcons = {
        fuel: "⛽ Yoqilg'i (Solyarka)",
        customs: "🛂 Bojxona/Chegara",
        road_fees: "🛣️ Yo'l/Tarozi/Patrik",
        maintenance: "🛠️ Zapchast/Remont",
        food_living: "🍔 Shofyor Ovqati",
        other: "📝 Boshqa Xarajatlar"
      };

      await ctx.reply(
        `✅ *AI xarajat ma'lumotlarini aniqladi!*\n\n` +
        `📂 *Kategoriya:* ${categoryIcons[parsedData.category] || parsedData.category}\n` +
        `💵 *Summa:* ${parsedData.amount.toLocaleString()} ${parsedData.currency}\n` +
        `ℹ️ *Tafsilot:* ${parsedData.description}`,
        { parse_mode: "Markdown" }
      );
    } else {
      await ctx.reply("🤷‍♂️ Xarajat miqdorini aniqlay olmadim. Iltimos, aniqroq yozing. (Masalan: Solyarkaga 10400 rubl ketdi)");
    }

  } catch (error) {
    console.error("Hugging Face API Error:", error);
    if (waitingMsg) {
      await ctx.api.deleteMessage(ctx.chat.id, waitingMsg.message_id).catch(() => {});
    }
    await ctx.reply("⚠️ Sun'iy intellekt xizmati ulanishda xatolik berdi. Qaytadan urinib ko'ring.", { parse_mode: "Markdown" });
  }
});

bot.catch((err) => { console.error("Global Bot Error:", err); });

bot.start();
console.log("🚀 Bot Hugging Face Llama-3 tizimida muvaffaqiyatli ishga tushdi!");
