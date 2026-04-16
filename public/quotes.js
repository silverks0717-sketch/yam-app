const QUOTES = [
  { cn: "今天不用完美，今天只要有一点点推进。", en: "A little progress is enough for today." },
  { cn: "轻一点，也可以走很远。", en: "Lightness can still carry you far." },
  { cn: "先把今天记下来，情绪会慢慢安静。", en: "Log today first, let the noise settle later." },
  { cn: "你不是在追赶，你是在慢慢变得清楚。", en: "You are not rushing, you are becoming clear." },
  { cn: "饭有痕迹，训练有回声，身体会记得。", en: "Meals leave traces, training leaves echoes." },
  { cn: "温柔一点，也能把事情做成。", en: "Gentleness can still get things done." },
  { cn: "今天先顾好节奏，其他的明天再说。", en: "Keep the rhythm today, the rest can wait." },
  { cn: "有些改变不是轰烈，是安静地发生。", en: "Some changes arrive quietly." },
  { cn: "先记一条，就算今天没有白过。", en: "One entry is enough to count today." },
  { cn: "身体从不说谎，它只是在慢慢回答你。", en: "Your body never lies, it answers slowly." },
  { cn: "晚一点没关系，别彻底断掉就好。", en: "Later is fine, disappearing is not." },
  { cn: "你不是在控制生活，你是在和它重新熟起来。", en: "You are not controlling life, you are getting familiar with it again." },
  { cn: "如果今天很乱，那就先把一顿饭记清楚。", en: "If the day feels messy, start with one clear meal." },
  { cn: "练得普通也没关系，出现本身就很珍贵。", en: "An ordinary session still matters." },
  { cn: "你在慢慢收回对自己的感觉。", en: "You are returning to yourself." },
  { cn: "有些稳定不是天生的，是一次次记录出来的。", en: "Stability is often recorded into existence." },
  { cn: "别急着判断自己，先把今天留下来。", en: "Do not judge today before you log it." },
  { cn: "身体这件事，温柔比用力更长久。", en: "With the body, softness lasts longer than force." },
  { cn: "有时候，一条小记录就能把日子接住。", en: "Sometimes one small note can hold the day together." },
  { cn: "再克制一点，再耐心一点，线条会出现。", en: "A little restraint, a little patience, and the shape appears." },
];

export function getDailyQuote(date = new Date()) {
  const key = localDateKey(date);
  const index = hashString(key) % QUOTES.length;
  return QUOTES[index];
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hashString(text) {
  let hash = 0;

  for (const char of text) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return hash;
}
