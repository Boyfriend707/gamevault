import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY;
const BOT_USERNAME = "GameBot";

const SYSTEM_PROMPT = `You are GameBot, a friendly AI assistant for GameVault — a gaming dashboard app.

GameVault features:
- Track your game collection (PC, PlayStation, Xbox, Nintendo, Mobile)
- Log playtime, set status (playing, completed, dropped, not-playing)
- Steam integration: link your Steam account, sync games and achievements
- Daily challenges with login streaks
- Goals system with auto-completion
- Chat with friends, send polls, react with emojis
- Badges: earn and display achievements
- Loot boxes: earn cosmetic items (profile frames, chat bubbles, name colors, badge variants)
- Profile customization: avatar, banner, bio, status message, decorations
- Friend system with privacy controls
- Import/export collection via CSV
- AI helper (that's me!)

Keep responses concise, helpful, and friendly. Use emojis occasionally. If asked about something outside your knowledge, be honest that you don't know. Never claim to be a human.`;

function getFallbackResponse(content) {
  const lower = content.toLowerCase();
  if (lower.includes("hello") || lower.includes("hi ") || lower === "hi" || lower.includes("hey") || lower.includes("sup"))
    return "Hey there! 👋 Welcome to GameVault! What can I help you with today?";
  if (lower.includes("help") || lower.includes("what can you"))
    return "I can help you with GameVault features! Ask me about:\n- Adding and tracking games 🎮\n- Steam integration 🔗\n- Daily challenges & streaks ⚡\n- Badges & loot boxes 🏆\n- Chat & friends 💬\n- Profile customization 🎨\n- Importing/exporting your collection 📁\n\nWhat would you like to know?";
  if (lower.includes("how") && (lower.includes("game") || lower.includes("add") || lower.includes("track")))
    return "To add a game, click the **+** button on your Collection page. Fill in the name, platform, and you can even link a Steam app ID to auto-fetch the cover art! For playtime tracking, set a local .exe path or link via Steam and use the ▶️ play button — the app will track your time automatically ⏱️";
  if (lower.includes("steam"))
    return "To link your Steam account, go to **Settings > Steam** and click 'Link Steam Account'. A Steam login window will open. After linking, you can sync your Steam library and achievements! 🎯";
  if (lower.includes("badge") || lower.includes("achievement"))
    return "Badges are special awards you can earn! Some are auto-awarded by the system (like for completing goals or hitting streaks). Admins can also create and award custom badges. Check your earned badges on your Profile page. Steam achievements can be synced too! 🏆";
  if (lower.includes("loot") || lower.includes("crate") || lower.includes("box") || lower.includes("cosmetic"))
    return "Loot boxes are earned when you level up! Go to **Appearance** and click 'Open Crate' to get a random cosmetic item. Rarity varies: Common (50%), Uncommon (30%), Rare (12%), Epic (6%), Legendary (2%). Equip them from the 'My Items' tab! 🎁";
  if (lower.includes("daily") || lower.includes("challenge") || lower.includes("streak"))
    return "Daily challenges refresh each day. Complete them to keep your login streak going! The longer your streak, the more rewards you'll get. Check the **Challenges** tab to see today's tasks! ⚡";
  if (lower.includes("friend") || lower.includes("message") || lower.includes("chat"))
    return "Go to a user's profile and click the message button to start chatting. You can send text, images, polls, and react with emojis. Your privacy settings control who can see your profile sections! 💬";
  if (lower.includes("import") || lower.includes("export") || lower.includes("csv"))
    return "On your Collection page, use the **Import** button to upload a CSV file with your games, or **Export** to download your collection as CSV. The format is: title, platform, status, playtime_hours, source, tags 📁";
  if (lower.includes("thank") || lower.includes("thanks") || lower.includes("ty"))
    return "You're welcome! 😊 Happy gaming with GameVault! Anything else I can help with?";
  if (lower.includes("bye") || lower.includes("goodbye") || lower.includes("see you"))
    return "See you later! Happy gaming! 🎮👋";

  return `I'm not sure about that. Try asking about GameVault features like adding games 🎮, Steam integration 🔗, daily challenges ⚡, badges 🏆, loot boxes 🎁, or chatting with friends 💬!`;
}

export async function generateResponse(userMessage) {
  if (API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const chat = model.startChat({ history: [{ role: "user", parts: [{ text: SYSTEM_PROMPT }] }, { role: "model", parts: [{ text: "Got it! I'm GameBot, ready to help with GameVault." }] }] });
      const result = await chat.sendMessage(userMessage);
      return result.response.text();
    } catch (e) {
      console.error("Gemini API error:", e.message);
    }
  }
  return getFallbackResponse(userMessage);
}

export { BOT_USERNAME };
