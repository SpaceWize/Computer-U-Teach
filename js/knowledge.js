// Fixer's answer bank and the engine that picks from it.
// Modelled on the owner's "Little Ace" helper (acespaders.com): the engine never writes an answer, it only
// chooses which published answer fits the question. Loaded the first time someone talks to Fixer.
//
// How a question is answered:
//   1. normalise it and fix common typos;
//   2. handle the fixed cases (greeting, thanks, "are you a bot", attempts to redirect the helper);
//   3. if it is a short follow-up ("how much?", "how do I book it?") answer it about the LAST topic;
//   4. otherwise score every intent: whole phrases, then single words weighted by how rare they are,
//      then RULES (tie-breaks keyed off the wording). Rules can steer between real matches but can
//      never invent a winner the question's own words did not touch;
//   5. a strong score answers; a weak on-topic one says "that isn't listed" and points to a person;
//      anything else gets the "I didn't follow" line with suggestions.
// The session remembers the last topic, rotates wordings, offers "did you mean" and follow-up chips,
// and remembers a name if the visitor gives one.

const BOOKING = 'https://signup-u-teach.as.me/';
const EMAIL = 'ComputerUteach@gmail.com';
const ADDRESS = '1628 W 1st Ave, Vancouver, BC V6J 1G1';
const L = {
  book: ['Open the booking page', BOOKING],
  repairs: ['Repair services', '#repairs'],
  pick: ['Repair options and prices', '#book'],
  classes: ['Classes and lessons', '#classes'],
  email: ['Email us', 'mailto:' + EMAIL]
};

/* ------------------------------------------------------------------ */
/* The answer bank. Facts come from the site and the booking page only. */
/* ------------------------------------------------------------------ */
const INTENTS = [
  { id: 'OVERVIEW', q: 'What do you do?',
    phrases: ['what do you do', 'what is this', 'what is this place', 'what services do you offer', 'how can you help'],
    signals: ['services', 'offer', 'about', 'business', 'shop', 'help'],
    answer: 'We repair computers and we teach people how to use them. Repairs start with a free 30-minute consult, and lessons are one-to-one and go at your pace.',
    alts: ['Two things: computer repair, and patient one-to-one computer lessons. If something is broken, the free 30-minute consult is the place to start.'],
    links: [L.repairs, L.classes] },

  { id: 'REPAIR_PRICES', q: 'How much is a repair?',
    phrases: ['how much is a repair', 'repair prices', 'repair cost', 'how much to fix', 'what do you charge', 'price list'],
    signals: ['repair', 'fix', 'price', 'cost', 'fee', 'charge', 'rate', 'quote', 'estimate', 'pricing'],
    answer: 'There are three repair options: a free 30-minute consult, a one-hour repair for CA$50, and the Guaranteed Fix (online only, one hour) for CA$65.',
    alts: ['Repairs come three ways. The 30-minute consult is free, an hour of repair is CA$50, and the online-only Guaranteed Fix is CA$65 for an hour.'],
    links: [L.pick, L.book] },

  { id: 'FREE_CONSULT', q: 'What is the free consult?',
    phrases: ['free consult', 'free consultation', 'free repair booking', 'is there a free option', 'is the first visit free'],
    signals: ['free', 'consult', 'consultation', 'diagnose', 'diagnosis', 'assessment', 'look'],
    answer: 'The free repair booking or consult is 30 minutes and costs nothing. It is the best start if you are not sure what is wrong: we take a look and tell you what it needs.',
    links: [L.book] },

  { id: 'HOUR_REPAIR', q: 'What is the one-hour repair?',
    phrases: ['one hour repair', '1 hour repair', 'hour of repair', '25 off', 'discount'],
    signals: ['hour', 'discount', 'sale', 'deal', 'promo'],
    answer: 'The one-hour repair is an hour of hands-on repair time for CA$50. The booking page lists it as 25% off.',
    links: [L.book] },

  { id: 'ONLINE_FIX', q: 'Can you fix my computer online?',
    phrases: ['guaranteed fix', 'online repair', 'remote repair', 'fix it remotely', 'fix my computer online', 'without coming in'],
    signals: ['online', 'remote', 'remotely', 'virtual', 'guaranteed', 'home', 'zoom'],
    answer: 'Yes. The Guaranteed Fix is a repair or consult done online only. It is one hour and costs CA$65.',
    links: [L.book] },

  { id: 'WHAT_FIX', q: 'What can you fix?',
    phrases: ['what can you fix', 'what do you repair', 'do you fix', 'can you fix', 'can you repair', 'do you repair'],
    signals: ['laptop', 'desktop', 'pc', 'mac', 'macbook', 'windows', 'screen', 'virus', 'malware', 'slow', 'battery', 'keyboard', 'drive', 'ssd', 'data', 'wifi', 'printer', 'phone', 'tablet', 'broken', 'crash', 'software', 'hardware', 'upgrade'],
    answer: 'Our technicians diagnose and fix computer issues so your device runs smoothly again. The site does not list every repair, so the surest way to know about yours is the free 30-minute consult.',
    alts: ['The site does not have a full list of repairs. One customer had a laptop hard drive swapped for an SSD. For anything specific, book the free consult and we will tell you if we can do it.'],
    links: [L.book] },

  { id: 'HOW_IT_WORKS', q: 'How does a repair work?',
    phrases: ['how does it work', 'how does a repair work', 'what is the process', 'what happens next', 'what are the steps'],
    signals: ['process', 'steps', 'works', 'happens', 'procedure'],
    answer: 'Three steps. Tell us what is wrong when you book, in your own words. We find the problem and fix it. Then you get your device back running smoothly.',
    links: [L.repairs, L.book] },

  { id: 'BOOK', q: 'How do I book?',
    phrases: ['how do i book', 'book a repair', 'make an appointment', 'book an appointment', 'schedule a repair', 'sign up'],
    signals: ['book', 'booking', 'appointment', 'schedule', 'reserve', 'signup', 'register'],
    answer: 'Booking is online. Pick the repair or lesson you want on the booking page and choose a time that suits you.',
    alts: ['You book online. The booking page shows each repair and lesson with the times that are open.'],
    links: [L.book] },

  { id: 'TURNAROUND', q: 'How long does a repair take?',
    phrases: ['how long does a repair take', 'how long will it take', 'when will it be ready', 'turnaround time', 'same day'],
    signals: ['turnaround', 'ready', 'quick', 'fast', 'urgent', 'today', 'wait'],
    answer: 'Repair bookings are 30 minutes or one hour. The site does not say how long a bigger job takes, so ask at the free consult and we will tell you for your device.',
    links: [L.book] },

  { id: 'LESSONS', q: 'Do you teach computer lessons?',
    phrases: ['computer lessons', 'computer classes', 'do you teach', 'learn computers', 'u teach lessons', 'private lessons'],
    signals: ['lesson', 'class', 'teach', 'learn', 'course', 'tutor', 'tutoring', 'training', 'student'],
    answer: 'Yes. U-Teach computer lessons are one-to-one, 50 minutes, and CA$65. There is also an online lesson for elders, one hour for CA$65.',
    alts: ['We do. A U-Teach computer lesson is 50 minutes one-to-one for CA$65, and elders can take a one-hour online lesson for the same price.'],
    links: [L.classes, L.book] },

  { id: 'ELDER_LESSON', q: 'Do you have lessons for seniors?',
    phrases: ['lessons for seniors', 'lessons for elders', 'senior classes', 'my mom', 'my dad', 'my grandmother', 'my grandfather', 'my parents'],
    signals: ['senior', 'elder', 'elderly', 'older', 'retired', 'grandma', 'grandpa', 'parent'],
    answer: 'Yes. The online lesson for elders is one hour for CA$65, taught patiently and at your own pace.',
    links: [L.classes, L.book] },

  { id: 'KIDS', q: 'Do you teach kids?',
    phrases: ['kids classes', 'kids camp', 'classes for kids', 'lessons for children', 'my son', 'my daughter', 'my child'],
    signals: ['kid', 'child', 'children', 'camp', 'teen', 'youth', 'young'],
    answer: 'We do teach kids. One parent wrote that their 9-year-old loved the kids computer camp. The current dates are not listed on the site, so please email us to ask.',
    links: [L.email] },

  { id: 'HTML_CLASS', q: 'Is there an HTML class?',
    phrases: ['html class', 'html classes', 'learn html', 'coding class', 'web design class', 'learn to code'],
    signals: ['html', 'css', 'coding', 'code', 'programming', 'webpage'],
    answer: 'An HTML class is on the way, but its length, price and dates are not published yet. Email us if you want to hear when it opens.',
    links: [L.classes, L.email] },

  { id: 'WEBSITE_PACKAGE', q: 'Can you build me a website?',
    phrases: ['build a website', 'build me a website', 'website starter package', 'make a website', 'need a website'],
    signals: ['website', 'site', 'starter', 'package', 'web'],
    answer: 'The Website starter package is 10 hours of work in total and begins with a 75-minute consult. It costs CA$450.',
    links: [L.book] },

  { id: 'LOCATION', q: 'Where are you?',
    phrases: ['where are you', 'where are you located', 'what is your address', 'how do i find you', 'where is the shop'],
    signals: ['where', 'address', 'location', 'located', 'directions', 'map', 'vancouver', 'downtown', '1st', 'avenue', 'kitsilano', 'parking'],
    answer: 'We are at ' + ADDRESS + '.',
    links: [] },

  { id: 'HOURS', q: 'When are you open?',
    phrases: ['when are you open', 'opening hours', 'what are your hours', 'are you open', 'what time do you close'],
    signals: ['hours', 'open', 'close', 'closed', 'weekend', 'saturday', 'sunday', 'monday', 'evening'],
    answer: 'I do not have confirmed opening hours yet. The booking page shows the times you can actually book.',
    links: [L.book] },

  { id: 'CONTACT', q: 'How do I contact you?',
    phrases: ['how do i contact you', 'get in touch', 'what is your email', 'phone number', 'can i call you'],
    signals: ['contact', 'email', 'phone', 'call', 'text', 'message', 'reach', 'number'],
    answer: 'Email is the surest way: ' + EMAIL + '. I do not have a confirmed phone number to give you yet.',
    links: [L.email, L.book] },

  { id: 'HUMAN', q: 'Can I talk to a person?',
    phrases: ['talk to a person', 'talk to a human', 'real person', 'speak to someone', 'talk to someone'],
    signals: ['human', 'person', 'someone', 'staff', 'technician'],
    answer: 'Of course. Email us, or book the free 30-minute consult and you will be talking to a person.',
    links: [L.email, L.book] },

  { id: 'REVIEWS', q: 'What do customers say?',
    phrases: ['what do customers say', 'are you any good', 'do you have reviews', 'can i trust you', 'testimonials'],
    signals: ['review', 'reviews', 'testimonial', 'trust', 'reliable', 'reputation', 'rating', 'good'],
    answer: 'There are three reviews on this page. One customer had a laptop drive upgraded to an SSD and called the service helpful, fast and reasonably priced. The other two are about lessons.',
    links: [L.repairs] },

  { id: 'WHO', q: 'Who does the repairs?',
    phrases: ['who does the repairs', 'who is the teacher', 'who runs this', 'who are you guys', 'who owns'],
    signals: ['who', 'owner', 'teacher', 'matt', 'matthew', 'team'],
    answer: 'The reviews on this page mention Matthew, who does repairs and teaches. The site does not have a fuller introduction yet.',
    links: [L.repairs] },

  { id: 'PAYMENT', q: 'How do I pay?',
    phrases: ['how do i pay', 'payment methods', 'do you take cards', 'do you accept', 'pay in cash'],
    signals: ['pay', 'payment', 'card', 'credit', 'debit', 'cash', 'etransfer', 'refund', 'deposit', 'invoice'],
    answer: 'The site does not list payment methods or refund terms. Prices are in Canadian dollars. Please email us to check before you book.',
    links: [L.email] },

  { id: 'GUARANTEE', q: 'Is the repair guaranteed?',
    phrases: ['is it guaranteed', 'what is the guarantee', 'what if it is not fixed', 'what if you cant fix it', 'warranty'],
    signals: ['guarantee', 'warranty', 'promise', 'refund'],
    answer: 'One option is called the Guaranteed Fix, but the site does not spell out what the guarantee covers. Please ask when you book so you know the terms.',
    links: [L.email, L.book] },

  { id: 'BOT', q: 'Are you a real person?',
    phrases: ['are you a bot', 'are you a robot', 'are you real', 'are you ai', 'who are you', 'what are you'],
    signals: ['bot', 'robot', 'chatgpt', 'ai', 'fixer'],
    answer: "I'm Fixer, a small scripted helper. I'm not a person and not an AI model: I pick from a short list of answers about this shop.",
    links: [] },

  { id: 'PRIVACY', q: 'Is this chat saved?',
    phrases: ['is this chat saved', 'do you record this', 'are you saving this', 'is this private'],
    signals: ['saved', 'record', 'recorded', 'privacy', 'private', 'logged', 'tracking'],
    answer: 'Nothing you type here is sent anywhere. The answers are worked out inside your own browser, and the chat is gone when you leave the page.',
    links: [] },

  { id: 'SMALL_TALK', q: '', phrases: [], signals: [],
    answer: "I'm doing well, thanks. I'm best at questions about repairs, prices, lessons and booking.",
    alts: ['All good here. Ask me about a repair, a lesson or how to book.'], links: [] },
  { id: 'OTHER', q: '', phrases: [], signals: [],
    answer: 'That is not something the site covers yet, so I would rather not guess. Email us, or ask at the free 30-minute consult.',
    alts: ['I do not have that listed. The free consult or an email will get you a proper answer.'], links: [L.email, L.book] },
  { id: 'NONSENSE', q: '', phrases: [], signals: [],
    answer: "I didn't follow that one. I can help with repairs, prices, lessons, booking, and where to find us.",
    alts: ['Sorry, that one is beyond me. Try asking about a repair, a lesson, or how to book.'], links: [] },
  { id: 'REDIRECT', q: '', phrases: [], signals: [],
    answer: 'I can only answer from my list about this shop. What would you like to know about repairs or lessons?', links: [] }
];

/* Short follow-ups, answered about the last topic. */
const FOLLOWUPS = {
  REPAIR_PRICES: { how_book: 'Pick the repair you want on the booking page and choose a time.', how_long: 'The consult is 30 minutes; the one-hour repair and the Guaranteed Fix are an hour each.', online: 'The Guaranteed Fix is the online one: one hour for CA$65.', free: 'Yes, the 30-minute consult is free.' },
  FREE_CONSULT: { how_much: 'It is free.', how_long: 'It is 30 minutes.', how_book: 'Choose "Free Computer Repair Booking or Consult" on the booking page.', whats_included: 'We look at the problem and tell you what it needs.' },
  HOUR_REPAIR: { how_much: 'CA$50 for the hour.', how_long: 'One hour.', how_book: 'Choose the one-hour repair on the booking page.' },
  ONLINE_FIX: { how_much: 'CA$65.', how_long: 'One hour.', how_book: 'Choose the Guaranteed Fix on the booking page.', when_where: 'It is online only, so you stay where you are.' },
  WHAT_FIX: { how_much: 'The consult is free, an hour of repair is CA$50, and the online Guaranteed Fix is CA$65.', how_book: 'Start with the free 30-minute consult on the booking page.', how_long: 'Bookings are 30 minutes or an hour; ask at the consult how long your job needs.' },
  HOW_IT_WORKS: { how_much: 'The consult is free, an hour of repair is CA$50, and the online Guaranteed Fix is CA$65.', how_book: 'Book online, starting with the free consult if you are unsure.', how_long: 'Bookings are 30 minutes or an hour.' },
  BOOK: { how_much: 'Repairs run from free (the consult) to CA$65; lessons are CA$65.', when_where: 'The booking page shows the open times. We are at ' + ADDRESS + '.' },
  LESSONS: { how_much: 'CA$65 for a 50-minute U-Teach lesson, and CA$65 for the one-hour online elders lesson.', how_long: 'A U-Teach lesson is 50 minutes; the elders lesson is an hour.', how_book: 'Choose the lesson on the booking page.', online: 'The elders lesson is online. The site does not say whether U-Teach lessons can be, so please ask.' },
  ELDER_LESSON: { how_much: 'CA$65.', how_long: 'One hour.', how_book: 'Choose "Online lesson for elders" on the booking page.', when_where: 'It is an online lesson.' },
  WEBSITE_PACKAGE: { how_much: 'CA$450.', how_long: '10 hours of work in total, starting with a 75-minute consult.', how_book: 'Book the starter package consult on the booking page.', whats_included: '10 hours of work in total, including the 75-minute first consult. The site does not list more detail.' },
  HTML_CLASS: { how_much: 'The price is not published yet.', how_long: 'The length is not published yet.', how_book: 'It cannot be booked yet. Email us to hear when it opens.' },
  KIDS: { how_much: 'The price is not listed. Please email us.', how_book: 'Email us to ask about the next kids camp.' },
  LOCATION: { when_where: 'We are at ' + ADDRESS + '.', how_book: 'Book online before you come in.' }
};
const FOLLOW_KIND = [
  ['free', /\b(free|no charge)\b/],
  ['how_much', /how much|\b(cost|costs|price|prices|fee|fees|charge|rate|expensive|cheap)\b/],
  ['how_long', /how long|\b(duration|length|minutes|long)\b/],
  ['how_book', /\b(book|booking|sign up|signup|register|schedule|reserve|get started)\b|how do i (start|get|do)/],
  ['online', /\b(online|remote|remotely|virtual|zoom|from home)\b/],
  ['whats_included', /\b(include|includes|included)\b|what do i get|whats in it/],
  ['when_where', /\b(where|when|location|address|what time)\b/]
];
const CHIP = { how_much: 'How much is it?', how_long: 'How long is it?', how_book: 'How do I book it?', online: 'Can it be done online?', whats_included: "What's included?" };
const CHIP_ORDER = ['how_much', 'how_book', 'how_long', 'online', 'whats_included'];

/* Tie-breaks: score adjustments keyed off the wording. */
const RULES = [
  [/\b(cost|costs|price|prices|pricing|fee|fees|charge|rate|rates)\b|how much/, { REPAIR_PRICES: 4 }],
  [/\b(lesson|lessons|class|classes|learn|teach)\b/, { LESSONS: 3, REPAIR_PRICES: -4, WHAT_FIX: -3 }],
  [/\b(senior|seniors|elder|elders|elderly|grandma|grandpa|grandmother|grandfather)\b|my (mom|mum|dad|parents)/, { ELDER_LESSON: 12, LESSONS: -4 }],
  [/\b(kid|kids|child|children|camp|son|daughter)\b/, { KIDS: 6 }],
  [/\bhtml\b|\bcoding\b|learn to code/, { HTML_CLASS: 8, LESSONS: -2 }],
  [/\b(website|web site)\b/, { WEBSITE_PACKAGE: 6, HTML_CLASS: -2 }],
  [/\b(online|remote|remotely|virtual)\b/, { ONLINE_FIX: 5 }],
  [/\bfree\b/, { FREE_CONSULT: 6, REPAIR_PRICES: -2 }],
  [/(can|do|could|will) you (fix|repair)|is (it|this) fixable/, { WHAT_FIX: 6, REPAIR_PRICES: -2 }],
  [/\b(urgent|asap|today|right away|emergency)\b/, { TURNAROUND: 5 }],
  [/\b(guarantee|guaranteed|warranty)\b/, { GUARANTEE: 6, ONLINE_FIX: -3 }],
  [/\b(real|actual) (person|human)\b|talk to (a )?(human|person|someone)|speak (to|with) (a )?(human|person|someone)/, { HUMAN: 10, BOT: -6, CONTACT: -2 }],
  [/\b(chatgpt|gpt|an ai|a bot|a robot|language model)\b|^(are|r) you\b|who are you|what are you/, { BOT: 10 }, true],
  [/\b(open|close|closed|hours)\b/, { HOURS: 5 }],
  [/\b(phone|call|email|text)\b/, { CONTACT: 4 }]
];
/* Answers close enough that offering one as "did you mean" after the other is just noise. */
const FAMILIES = [['REPAIR_PRICES', 'FREE_CONSULT', 'HOUR_REPAIR', 'ONLINE_FIX'], ['WHAT_FIX', 'HOW_IT_WORKS', 'TURNAROUND'],
  ['LESSONS', 'ELDER_LESSON', 'KIDS', 'HTML_CLASS'], ['CONTACT', 'HUMAN'], ['BOT', 'PRIVACY'], ['LOCATION', 'HOURS']];
const sameFamily = (a, b) => FAMILIES.some(f => f.includes(a) && f.includes(b));
const NO_ANSWER = new Set(['SMALL_TALK', 'OTHER', 'NONSENSE', 'REDIRECT']);

/* ------------------------------------------------------------------ */
/* Text handling                                                       */
/* ------------------------------------------------------------------ */
const STOP = new Set('a an and are as at be but by can could do does for from had has have he her him his how i if in into is it its me my of on or our she so than that the their them then there these they this to up us was we were what when which who why will with would you your am im'.split(' '));
const FIXUPS = { wat: 'what', wot: 'what', hw: 'how', u: 'you', ur: 'your', r: 'are', pls: 'please', plz: 'please', thx: 'thanks', ty: 'thanks', abt: 'about', mcuh: 'much', muc: 'much', bok: 'book', boking: 'booking', prise: 'price', pc: 'computer', comp: 'computer', laptops: 'laptop', appt: 'appointment', info: 'information', wanna: 'want to', gonna: 'going to', cant: 'cannot', wifi: 'wifi' };
/* Real four-letter words are never "corrected": "feel" is one edit from "fees". */
const COMMON4 = new Set('feel fear fell felt free fine five form four gone good here home hope hour idea just keep kind know last late less life like line list live long look lost love made make many mean more most move much name near next nice once only open over past plan play read real rest safe same save seem send show side sign slow some soon stop sure take talk tell that them then they this time told took true turn used very wait want week well went were what when will wish with word work year your cash case cars card done fail fast fire hard head hear help kids lots mind miss mine news paid part pick push rate sold test tips tool'.split(' '));
const normalize = t => String(t || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9$% ]/g, ' ').replace(/\s+/g, ' ').trim();
const stem = w => w.length > 4 ? w.replace(/(ing|ed|es|s)$/, '') : w;
const tokens = t => normalize(t).split(' ').filter(w => w && !STOP.has(w)).map(stem);
function close(a, b) {                                   // one edit apart (two for long words)
  if (a === b) return true;
  const max = Math.max(a.length, b.length) >= 8 ? 2 : 1;
  if (Math.abs(a.length - b.length) > max) return false;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0]; prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const keepV = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = keepV;
    }
  }
  return prev[b.length] <= max;
}

const docs = INTENTS.filter(i => !NO_ANSWER.has(i.id)).map(i => ({
  id: i.id,
  phrases: i.phrases.map(normalize),
  words: new Set([...i.phrases, ...i.signals, i.q].flatMap(tokens))
}));
const VOCAB = new Set(docs.flatMap(d => [...d.words]).filter(w => w.length >= 5));
const df = new Map();
for (const d of docs) for (const w of d.words) df.set(w, (df.get(w) || 0) + 1);
const idf = w => Math.log(1 + docs.length / (df.get(w) || 1));
const byId = id => INTENTS.find(i => i.id === id);

function despell(q) {
  return q.split(' ').map(w => {
    if (FIXUPS[w]) return FIXUPS[w];
    if (w.length < 5 || COMMON4.has(w) || STOP.has(w)) return w;
    const s = stem(w);
    if (VOCAB.has(s) || df.has(s)) return w;
    for (const v of VOCAB) { if (v.length < s.length && s.startsWith(v)) continue; if (close(s, v)) return v; }
    return w;
  }).join(' ');
}

/* Score the question against the bank. Returns { id, runner } or null. */
function score(q) {
  const qset = new Set(tokens(q)), padded = ' ' + q + ' ';
  const scores = new Map(), base = new Map();
  for (const d of docs) {
    let n = 0;
    for (const p of d.phrases) if (p && padded.includes(' ' + p + ' ')) n += 8 + Math.min(p.length / 6, 6);
    for (const t of qset) {
      if (d.words.has(t)) n += 1.6 * idf(t);
      else if (t.length >= 5) for (const w of d.words) if (close(t, w)) { n += 0.8 * idf(w); break; }
    }
    if (n > 0) { scores.set(d.id, n); base.set(d.id, n); }
  }
  for (const [re, adds, strong] of RULES) if (re.test(q)) for (const id in adds) {
    if (scores.has(id) || adds[id] > 0) scores.set(id, (scores.get(id) || 0) + adds[id]);
    if (adds[id] > 0 && strong) base.set(id, (base.get(id) || 0) + adds[id]);    // this pattern counts as evidence
  }
  let best = null, bs = 0;
  for (const [id, n] of scores) if (n > bs && (base.get(id) || 0) > 0) { bs = n; best = id; }
  let runner = null, rs = 0;
  for (const [id, n] of scores) if (id !== best && n > rs && (base.get(id) || 0) > 0) { rs = n; runner = id; }
  if (!(rs >= 6 && rs >= bs * 0.85 && !sameFamily(best, runner))) runner = null;
  return { best, bs, runner, onTopic: [...qset].some(t => df.has(t)) };
}

/* ------------------------------------------------------------------ */
/* One conversation                                                    */
/* ------------------------------------------------------------------ */
export const STARTERS = ['Repair prices', 'Book a repair', 'Lessons'];
export const GREETING = "Hi, I'm Fixer, the shop's brick helper. I'm not a person or an AI: I answer from a short list about repairs, prices, lessons and how to reach us.";

export function createSession() {
  const s = { last: null, used: {}, asked: {}, name: null, turns: 0 };

  function pack(id, text, links, extra) { return { id, text, links: links || [], suggest: [], ...extra }; }
  /* Rotate an intent's wordings so the same one never comes twice running. */
  function fromIntent(id, runner) {
    const it = byId(id), all = [it.answer].concat(it.alts || []);
    const i = s.used[id] || 0; s.used[id] = i + 1;
    const again = i >= all.length && all.length > 1 ? 'As I said: ' : i >= 1 && all.length === 1 ? 'Same answer as before: ' : '';
    return pack(id, again + all[i % all.length], it.links, { runner });
  }
  function chips(p) {
    const out = [];
    if (p.runner) { const r = byId(p.runner); if (r && r.q) out.push(r.q); }
    const F = FOLLOWUPS[p.id], done = s.asked[p.id] || new Set();
    if (F) for (const k of CHIP_ORDER) if (F[k] && !done.has(k) && CHIP[k] && out.length < 3 && k !== p.kind) out.push(CHIP[k]);
    return out;
  }

  function respond(raw) {
    const q = despell(normalize(raw));
    if (!q) return null;
    const qt = q.split(' ');

    if (/ignore (all |your )?(previous|prior)|system prompt|api key|pretend (you are|to be)|act as\b/.test(q)) return fromIntent('REDIRECT');
    const named = q.match(/^(?:hi |hello |hey )?(?:my name is|i am called|call me|this is) ([a-z]{2,15})$/);
    if (named) { s.name = named[1][0].toUpperCase() + named[1].slice(1); return pack('NAME', `Nice to meet you, ${s.name}. What can I help you with?`); }
    if (/^(hi|hello|hey|yo|hiya|howdy|good (morning|afternoon|evening|day))( there| fixer)?$/.test(q)) return pack('GREETING', `Hello${s.name ? ', ' + s.name : ''}! Ask me about a repair, a lesson, or how to book.`);
    if (/^(thanks|thank you|cheers|great|awesome|perfect|ok|okay|cool|got it)( so much| a lot| fixer)?$/.test(q)) return pack('THANKS', 'You are welcome. Anything else?', [L.book]);
    if (/^(bye|goodbye|see you|see ya|later)\b/.test(q)) return pack('BYE', 'Bye for now. Good luck with the computer!');

    /* A short follow-up about the last topic: "how much?", "how do I book it?" */
    const refersBack = /\b(it|that|this|those|one)\b/.test(q) || qt.length <= 3;
    const kind = qt.length <= 8 ? (FOLLOW_KIND.find(f => f[1].test(q)) || [null])[0] : null;
    const sc = score(q);
    if (s.last && kind && refersBack && FOLLOWUPS[s.last] && FOLLOWUPS[s.last][kind] && !(sc.bs >= 14 && sc.best !== s.last)) {
      (s.asked[s.last] = s.asked[s.last] || new Set()).add(kind);
      return pack(s.last, FOLLOWUPS[s.last][kind], byId(s.last).links, { kind });
    }
    if (s.last && qt.length <= 4 && /tell me more|more (info|detail)|go on|what else/.test(q)) {
      const it = byId(s.last);
      if (it.links.length) return pack(s.last, 'The links below cover it best. Or ask me something specific about it.', it.links);
    }
    if (qt.length <= 5 && /how are you|hows it going|whats up|nice to meet/.test(q)) return fromIntent('SMALL_TALK');

    if (sc.best && sc.bs >= 6) return fromIntent(sc.best, sc.runner);
    if (sc.best && sc.bs >= 3) return fromIntent(sc.best);
    if (sc.onTopic || /\b(computer|laptop|repair|fix|lesson|class)\b/.test(q)) return fromIntent('OTHER');
    return fromIntent('NONSENSE');
  }

  return {
    state: s,
    reply(raw) {
      const p = respond(raw);
      if (!p) return null;
      s.turns++;
      if (!NO_ANSWER.has(p.id) && byId(p.id)) s.last = p.id;
      /* Use their name now and then, after an actual question. */
      if (s.name && s.turns % 3 === 0 && byId(p.id) && !NO_ANSWER.has(p.id) && !p.kind) p.text = `Good question, ${s.name}. ` + p.text;
      p.suggest = NO_ANSWER.has(p.id) || !byId(p.id) ? (p.id === 'NONSENSE' || p.id === 'OTHER' ? STARTERS.slice() : []) : chips(p);
      return p;
    }
  };
}
