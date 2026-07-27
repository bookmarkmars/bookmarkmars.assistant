/**
 * Add new-tab greeting strings to all locales (fallback: English already in en/).
 * Run: node scripts/add-newtab-greetings.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, "..", "src", "_locales");

const greet = {
  es: { m: "Buenos días — listo para explorar", a: "Buenas tardes — mantén la curiosidad", e: "Buenas noches — encuentra lo importante", n: "Buenas noches — modo enfoque" },
  fr: { m: "Bonjour — prêt à explorer", a: "Bon après-midi — restez curieux", e: "Bonsoir — trouvez l'essentiel", n: "Bonne nuit — mode calme" },
  pt: { m: "Bom dia — pronto para explorar", a: "Boa tarde — mantenha a curiosidade", e: "Boa noite — encontre o que importa", n: "Boa noite — modo foco" },
  de: { m: "Guten Morgen — bereit zu entdecken", a: "Guten Tag — bleib neugierig", e: "Guten Abend — finde Wichtiges", n: "Gute Nacht — ruhiger Fokus" },
  ja: { m: "おはようございます", a: "こんにちは", e: "こんばんは", n: "おやすみなさい" },
  ko: { m: "좋은 아침입니다", a: "좋은 오후입니다", e: "좋은 저녁입니다", n: "편안한 밤 되세요" },
  ru: { m: "Доброе утро — готовы исследовать", a: "Добрый день — оставайтесь любопытными", e: "Добрый вечер — найдите важное", n: "Доброй ночи — тихий режим" },
  it: { m: "Buongiorno — pronto a esplorare", a: "Buon pomeriggio — resta curioso", e: "Buonasera — trova ciò che conta", n: "Buonanotte — modalità focus" },
  ar: { m: "صباح الخير — جاهز للاستكشاف", a: "مساء الخير — ابقَ فضوليًا", e: "مساء الخير — اعثر على المهم", n: "تصبح على خير — وضع التركيز" },
  he: { m: "בוקר טוב — מוכנים לחקור", a: "צהריים טובים — הישארו סקרנים", e: "ערב טוב — מצאו את החשוב", n: "לילה טוב — מצב מיקוד" },
  hi: { m: "सुप्रभात — खोजने के लिए तैयार", a: "नमस्कार — जिज्ञासु रहें", e: "शुभ संध्या — ज़रूरी खोजें", n: "शुभ रात्रि — शांत मोड" },
  th: { m: "อรุณสวัสดิ์ — พร้อมสำรวจ", a: "สวัสดีตอนบ่าย — รักษาความอยากรู้", e: "สวัสดีตอนเย็น — ค้นหาสิ่งสำคัญ", n: "ราตรีสวัสดิ์ — โหมดโฟกัส" },
  vi: { m: "Chào buổi sáng — sẵn sàng khám phá", a: "Chào buổi chiều — giữ sự tò mò", e: "Chào buổi tối — tìm điều quan trọng", n: "Chúc ngủ ngon — chế độ tập trung" },
  tr: { m: "Günaydın — keşfetmeye hazır", a: "Tünaydın — meraklı kalın", e: "İyi akşamlar — önemli olanı bulun", n: "İyi geceler — odak modu" },
  pl: { m: "Dzień dobry — gotowy do odkrywania", a: "Dzień dobry — bądź ciekawy", e: "Dobry wieczór — znajdź ważne", n: "Dobranoc — tryb skupienia" },
  nl: { m: "Goedemorgen — klaar om te verkennen", a: "Goedemiddag — blijf nieuwsgierig", e: "Goedenavond — vind wat telt", n: "Goedenacht — focusmodus" },
  uk: { m: "Доброго ранку — готові досліджувати", a: "Добрий день — залишайтеся цікавими", e: "Добрий вечір — знайдіть важливе", n: "Надобраніч — тихий режим" },
  id: { m: "Selamat pagi — siap menjelajah", a: "Selamat siang — tetap ingin tahu", e: "Selamat malam — temukan yang penting", n: "Selamat malam — mode fokus" },
  cl: { m: "Buenos días — listo para explorar", a: "Buenas tardes — mantén la curiosidad", e: "Buenas noches — encuentra lo importante", n: "Buenas noches — modo enfoque" },
  mx: { m: "Buenos días — listo para explorar", a: "Buenas tardes — mantén la curiosidad", e: "Buenas noches — encuentra lo importante", n: "Buenas noches — modo enfoque" },
};

for (const lang of Object.keys(greet)) {
  const fp = path.join(dir, lang, "messages.json");
  const m = JSON.parse(fs.readFileSync(fp, "utf8"));
  const g = greet[lang];
  m.new_tab_greeting_morning = { message: g.m };
  m.new_tab_greeting_afternoon = { message: g.a };
  m.new_tab_greeting_evening = { message: g.e };
  m.new_tab_greeting_night = { message: g.n };
  fs.writeFileSync(fp, JSON.stringify(m, null, 4) + "\n");
  console.log("ok", lang);
}
