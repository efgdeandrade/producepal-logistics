import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Multi-language response templates
// Dre - Your friendly FUIK order buddy
// IMPORTANT: FUIK sells FRESH PRODUCE ONLY - fruits, vegetables, herbs, and fresh juices
// NO fish, meat, or seafood - despite the company name, we specialize in fresh produce!
const RESPONSE_TEMPLATES = {
  welcome_new: {
    pap: "Kon ta! 👋 Mi ta Dre, bo kompañero di order di FUIK! 🥬🍎 Ki fruta òf bèrdura bo ke pidi awe?",
    en: "Hey! 👋 I'm Dre, your FUIK order buddy! 🥬🍎 What fresh fruits or veggies can I get for you today?",
    nl: "Hoi! 👋 Ik ben Dre, je FUIK bestelmaatje! 🥬🍎 Welk vers fruit of groente kan ik voor je regelen?",
    es: "¡Hola! 👋 Soy Dre, tu amigo de pedidos de FUIK! 🥬🍎 ¿Qué frutas o verduras frescas puedo conseguirte hoy?"
  },
  order_recap: {
    pap: "📋 Bo orden:\n{items}\n\nTur kos ta bon? Bisa 'Si' pa konfirmá. 🥕",
    en: "📋 Your order:\n{items}\n\nEverything correct? Say 'Yes' to confirm. 🥕",
    nl: "📋 Je bestelling:\n{items}\n\nKlopt alles? Zeg 'Ja' om te bevestigen. 🥕",
    es: "📋 Tu pedido:\n{items}\n\n¿Todo correcto? Di 'Sí' para confirmar. 🥕"
  },
  order_confirmed: {
    pap: "✅ Mashá bon! Dre tin bo cubrí! Bo orden ta registrá. Nos lo entregá bo fruta i bèrdura pronto. 🚚🥬",
    en: "✅ Awesome! Dre's got you covered! Your order is placed. We'll deliver your fresh produce soon. 🚚🥬",
    nl: "✅ Top! Dre regelt het! Je bestelling is geplaatst. We bezorgen je verse producten snel. 🚚🥬",
    es: "✅ ¡Genial! ¡Dre te tiene cubierto! Tu pedido está registrado. Entregaremos tus productos frescos pronto. 🚚🥬"
  },
  addition_confirmed: {
    pap: "✅ Klaar! Dre a agregá e produktonan na bo orden. 🚚🍎",
    en: "✅ Done! Dre added the items to your order. 🚚🍎",
    nl: "✅ Geregeld! Dre heeft de items aan je bestelling toegevoegd. 🚚🍎",
    es: "✅ ¡Listo! Dre agregó los productos a tu pedido. 🚚🍎"
  },
  suggestions: {
    pap: "💡 Bo tabata order tambe: {products}. Bo ke agrega un di nan? 🥕",
    en: "💡 You've also ordered before: {products}. Would you like to add any? 🥕",
    nl: "💡 Je hebt eerder ook besteld: {products}. Wil je iets toevoegen? 🥕",
    es: "💡 También has pedido antes: {products}. ¿Te gustaría agregar alguno? 🥕"
  },
  // Multiple no_match variations to avoid repetition
  no_match: {
    pap: [
      "🤔 Hmm, Dre no por haña '{item}'. Nos tin fruta, bèrdura i djùs frèsku. Purba otro nomber?",
      "🤔 '{item}' no ta den nos lista. Nos ta bende fruta i bèrdura frèsku solamente. Tin otro kos bo ke pidi?",
      "🤔 Mi no ta ripará '{item}'. Por fabor check nos lista di fruta i bèrdura?"
    ],
    en: [
      "🤔 Hmm, Dre couldn't find '{item}'. We carry fresh fruits, veggies and juices. Try another name?",
      "🤔 '{item}' isn't in our list. We sell fresh produce only - no meat or fish. Anything else?",
      "🤔 I don't recognize '{item}'. Check our fresh fruits and vegetables selection?"
    ],
    nl: [
      "🤔 Hmm, Dre kon '{item}' niet vinden. We hebben vers fruit, groente en sap. Probeer een andere naam?",
      "🤔 '{item}' staat niet in onze lijst. We verkopen alleen verse producten - geen vlees of vis. Iets anders?",
      "🤔 Ik herken '{item}' niet. Bekijk onze verse groente en fruit selectie?"
    ],
    es: [
      "🤔 Hmm, Dre no encontró '{item}'. Tenemos frutas, verduras y jugos frescos. ¿Otro nombre?",
      "🤔 '{item}' no está en nuestra lista. Solo vendemos productos frescos - sin carne ni pescado. ¿Algo más?",
      "🤔 No reconozco '{item}'. ¿Revisar nuestra selección de frutas y verduras frescas?"
    ]
  },
  greeting_response: {
    pap: "Kon ta! Dre aki 👋 Ki fruta òf bèrdura bo ke pidi awe? 🥬",
    en: "Hey there! Dre here 👋 What fresh produce would you like to order today? 🥬",
    nl: "Hoi! Dre hier 👋 Welke verse groente of fruit wil je vandaag bestellen? 🥬",
    es: "¡Hola! Dre aquí 👋 ¿Qué productos frescos te gustaría pedir hoy? 🥬"
  },
  cancel_item_success: {
    pap: "🚫 Oke, Dre a kita '{item}' for di bo orden.",
    en: "🚫 Got it! Dre removed '{item}' from your order.",
    nl: "🚫 Begrepen! Dre heeft '{item}' uit je bestelling gehaald.",
    es: "🚫 ¡Entendido! Dre quitó '{item}' de tu pedido."
  },
  cancel_order_success: {
    pap: "🚫 Oke, Dre a kansela bo orden kompletu. Te próksimo biaha!",
    en: "🚫 Alright, Dre cancelled your entire order. See you next time!",
    nl: "🚫 Oké, Dre heeft je hele bestelling geannuleerd. Tot de volgende keer!",
    es: "🚫 Listo, Dre canceló tu pedido completo. ¡Hasta la próxima!"
  },
  cancel_too_late: {
    pap: "⚠️ Ai, bo orden a pasa mas ku {hours} ora kaba. Por fabor yama nos pa kansela.",
    en: "⚠️ Oops, your order was placed more than {hours} hours ago. Please call us to cancel.",
    nl: "⚠️ Oeps, je bestelling is meer dan {hours} uur geleden geplaatst. Bel ons om te annuleren.",
    es: "⚠️ Ups, tu pedido fue realizado hace más de {hours} horas. Por favor llámanos para cancelar."
  },
  no_recent_order: {
    pap: "🤔 Dre no por haña ningun orden resien pa bo. Bo ke pidi algo nobo?",
    en: "🤔 Dre couldn't find any recent order for you. Would you like to place a new order?",
    nl: "🤔 Dre kon geen recente bestelling voor je vinden. Wil je een nieuwe bestelling plaatsen?",
    es: "🤔 Dre no pudo encontrar ningún pedido reciente tuyo. ¿Te gustaría hacer uno nuevo?"
  },
  existing_order_today: {
    pap: "📦 Bo tin un orden pa awe kaba ({order_number}). E produktonan nobo ta pa e mesun orden, òf pa mañan?",
    en: "📦 You already have an order for today ({order_number}). Are these new items for the same order, or for tomorrow?",
    nl: "📦 Je hebt al een bestelling voor vandaag ({order_number}). Zijn deze nieuwe items voor dezelfde bestelling, of voor morgen?",
    es: "📦 Ya tienes un pedido para hoy ({order_number}). ¿Estos nuevos items son para el mismo pedido, o para mañana?"
  },
  same_order_today: {
    pap: "mesun orden",
    en: "same order",
    nl: "zelfde bestelling",
    es: "mismo pedido"
  },
  for_tomorrow: {
    pap: "mañan",
    en: "tomorrow",
    nl: "morgen",
    es: "mañana"
  },
  escalation_picking: {
    pap: "⚠️ Bo orden ta wordo preparé awor. Dre ta kontaktá @{team_member} ({role}) pa mira si nos por ainda {action}.",
    en: "⚠️ Your order is currently being prepared. Dre is contacting @{team_member} ({role}) to see if we can still {action}.",
    nl: "⚠️ Je bestelling wordt nu voorbereid. Dre neemt contact op met @{team_member} ({role}) om te kijken of we nog {action} kunnen.",
    es: "⚠️ Tu pedido se está preparando ahora. Dre está contactando a @{team_member} ({role}) para ver si aún podemos {action}."
  },
  escalation_team_notification: {
    pap: "🔔 @{team_member} - Kliente {customer_name} ta pidi: {request}\n\nOrden: {order_number}\nStatus: {status}\n\nPor fabor respondé si nos por ainda hasi esaki.",
    en: "🔔 @{team_member} - Customer {customer_name} is requesting: {request}\n\nOrder: {order_number}\nStatus: {status}\n\nPlease respond if we can still do this.",
    nl: "🔔 @{team_member} - Klant {customer_name} vraagt: {request}\n\nBestelling: {order_number}\nStatus: {status}\n\nGelieve te reageren of we dit nog kunnen doen.",
    es: "🔔 @{team_member} - El cliente {customer_name} solicita: {request}\n\nPedido: {order_number}\nEstado: {status}\n\nPor favor responde si aún podemos hacer esto."
  },
  // Human escalation request responses
  human_escalation: {
    pap: "👤 Sin problema! Mi ta pasa bo na un di nos ekipo. Un momento por fabor, nan lo kontaktá bo pronto.",
    en: "👤 No problem! I'm connecting you with our team. One moment please, they'll reach out shortly.",
    nl: "👤 Geen probleem! Ik verbind je met ons team. Even geduld, ze nemen snel contact op.",
    es: "👤 ¡Sin problema! Te estoy conectando con nuestro equipo. Un momento, te contactarán pronto."
  },
  human_escalation_team: {
    pap: "🆘 Kliente {customer_name} ({phone}) ta pidi pa papia ku un hende. Mensahe original: \"{message}\"\n\nPor fabor kontakta nan.",
    en: "🆘 Customer {customer_name} ({phone}) requested to speak with a person. Original message: \"{message}\"\n\nPlease contact them.",
    nl: "🆘 Klant {customer_name} ({phone}) wil met een persoon praten. Origineel bericht: \"{message}\"\n\nNeem contact op.",
    es: "🆘 Cliente {customer_name} ({phone}) solicitó hablar con una persona. Mensaje original: \"{message}\"\n\nPor favor contáctale."
  },
  // Complaint escalation (direct message to management)
  complaint_customer: {
    pap: "Mi ta sinti esaki, {customer_name}. Mi ta notifiká maneho awor mesora. Nan lo kontaktá bo pronto pa resolve esaki. 🙏",
    en: "I hear you, {customer_name}. I'm notifying management right now. They'll reach out to you shortly to resolve this. 🙏",
    nl: "Ik begrijp het, {customer_name}. Ik breng nu management op de hoogte. Ze nemen snel contact met je op. 🙏",
    es: "Te escucho, {customer_name}. Estoy notificando a gerencia ahora. Te contactarán pronto para resolverlo. 🙏"
  },
  complaint_team: {
    pap: "⚠️ *Kliente kla* - {customer_name}\n📱 {phone}\n\n*Mensahe:*\n\"{message}\"\n\n*Orden:* {order_info}\n\nPor fabor kontakta kliente lo mas lihe posibel.",
    en: "⚠️ *Customer Complaint* - {customer_name}\n📱 {phone}\n\n*Message:*\n\"{message}\"\n\n*Order:* {order_info}\n\nPlease contact customer ASAP.",
    nl: "⚠️ *Klacht klant* - {customer_name}\n📱 {phone}\n\n*Bericht:*\n\"{message}\"\n\n*Bestelling:* {order_info}\n\nNeem zsm contact op met klant.",
    es: "⚠️ *Queja de cliente* - {customer_name}\n📱 {phone}\n\n*Mensaje:*\n\"{message}\"\n\n*Pedido:* {order_info}\n\nContactar al cliente lo antes posible."
  }
};

// Language detection patterns
// Note: FUIK sells fresh produce (fruits, vegetables, juices) - NOT fish/meat
const LANGUAGE_PATTERNS = {
  pap: ['bon', 'dia', 'tardi', 'nochi', 'danki', 'por', 'fabor', 'mi', 'ke', 'pidi', 'awe', 'kico', 'tur', 'si', 'no', 'mas', 'awa', 'fruta', 'bèrdura', 'e', 'ta', 'un', 'dos', 'tres', 'kansela', 'kita', 'agrega', 'mesun', 'mañan'],
  nl: ['goedemorgen', 'goedemiddag', 'goedenavond', 'bedankt', 'alstublieft', 'graag', 'bestellen', 'wil', 'hebben', 'ja', 'nee', 'meer', 'water', 'fruit', 'groente', 'de', 'het', 'een', 'twee', 'drie', 'annuleren', 'verwijderen', 'toevoegen', 'zelfde', 'morgen'],
  es: ['buenos', 'dias', 'tardes', 'noches', 'gracias', 'favor', 'quiero', 'pedir', 'hoy', 'sí', 'no', 'más', 'agua', 'fruta', 'verdura', 'el', 'la', 'uno', 'dos', 'tres', 'cancelar', 'quitar', 'agregar', 'mismo', 'mañana'],
  en: ['good', 'morning', 'afternoon', 'evening', 'thanks', 'please', 'want', 'order', 'today', 'yes', 'no', 'more', 'water', 'fruit', 'vegetable', 'the', 'a', 'one', 'two', 'three', 'cancel', 'remove', 'add', 'same', 'tomorrow']
};

// Cancellation patterns
const CANCEL_PATTERNS = {
  order: ['cancel order', 'cancel my order', 'kansela orden', 'kansela mi orden', 'annuleer bestelling', 'cancelar pedido', 'cancelar mi pedido', 'no kier mas', 'niet meer', 'no quiero'],
  item: ['cancel', 'remove', 'kansela', 'kita', 'annuleer', 'verwijder', 'cancelar', 'quitar', 'no kier', 'niet', 'sin']
};

// Addition patterns
const ADDITION_PATTERNS = ['add', 'also', 'more', 'extra', 'agrega', 'mas', 'tambe', 'toevoegen', 'ook', 'nog', 'agregar', 'también', 'además'];

// Same order / tomorrow detection patterns
const SAME_ORDER_PATTERNS = ['same order', 'same', 'mesun', 'mesun orden', 'zelfde', 'zelfde bestelling', 'mismo', 'mismo pedido', 'awe', 'today', 'vandaag', 'hoy'];
const TOMORROW_PATTERNS = ['tomorrow', 'mañan', 'mayan', 'majan', 'manyan', 'morgen', 'mañana', 'next', 'otro dia', 'another day'];

// Human escalation patterns - when customer wants to talk to a real person
const HUMAN_ESCALATION_PATTERNS = [
  // Papiamento
  'papia ku un hende', 'papia ku hende', 'un hende', 'yama mi', 'por yama', 'habla ku alguien',
  'mi ke papia', 'no bo, un hende', 'persona real', 'hende real',
  // English
  'speak to someone', 'talk to someone', 'real person', 'human', 'speak to a person', 
  'talk to a person', 'customer service', 'representative', 'agent', 'call me', 'phone call',
  'speak with someone', 'not a bot', 'actual person',
  // Dutch
  'met iemand praten', 'echt persoon', 'echte persoon', 'menselijke', 'met een mens',
  'bel me', 'klantenservice', 'medewerker',
  // Spanish
  'hablar con alguien', 'persona real', 'una persona', 'servicio al cliente',
  'representante', 'llámame', 'no un robot', 'atención humana'
];

// Complaint patterns - critical escalation to management
const COMPLAINT_PATTERNS = [
  // Papiamento
  'no ta bon', 'malu', 'problema', 'reklama', 'kla', 'no ta korekto', 'fòut', 'frustrado',
  'dañá', 'podri', 'ta keda tardi', 'mi ta braba', 'mi no ta kontento', 'ken ta maneha',
  'mi ke papia ku maneho', 'esaki no por', 'basta',
  // English
  'complaint', 'problem', 'issue', 'wrong', 'bad', 'terrible', 'upset', 'angry', 'frustrated',
  'damaged', 'rotten', 'late delivery', 'poor quality', 'disappointed', 'unacceptable',
  'refund', 'compensation', 'not happy', 'speak to manager', 'this is ridiculous',
  'worst', 'never again', 'disgusting',
  // Dutch
  'klacht', 'probleem', 'fout', 'verkeerd', 'slecht', 'boos', 'gefrustreerd', 'kapot',
  'rot', 'te laat', 'slechte kwaliteit', 'teleurgesteld', 'onacceptabel', 'manager spreken',
  'terugbetaling', 'compensatie', 'niet tevreden', 'dit kan niet',
  // Spanish
  'queja', 'problema', 'mal', 'error', 'terrible', 'enojado', 'frustrado', 'dañado',
  'podrido', 'entrega tardía', 'mala calidad', 'decepcionado', 'inaceptable', 'reembolso',
  'compensación', 'no estoy feliz', 'hablar con gerente', 'ridiculo'
];

// Team role escalation mapping
const ESCALATION_TRIGGERS = {
  logistics: ['add', 'agrega', 'change', 'cambia', 'toevoegen', 'wijzig', 'more', 'extra', 'modificar'],
  management: ['discount', 'descuento', 'korting', 'price', 'precio', 'prijs', 'special', 'exception', 'problema', 'problem'],
  accounting: ['invoice', 'factura', 'factuur', 'payment', 'pago', 'betaling', 'credit', 'credito']
};

// Get a varied no_match response to avoid repetition
let noMatchCounter = 0;
function getNoMatchResponse(language: string, item: string): string {
  const responses = RESPONSE_TEMPLATES.no_match[language as keyof typeof RESPONSE_TEMPLATES.no_match] || RESPONSE_TEMPLATES.no_match.pap;
  const response = responses[noMatchCounter % responses.length];
  noMatchCounter++;
  return response.replace('{item}', item);
}

// Detect language from text
function detectLanguage(text: string, customerPreference?: string | null): string {
  if (customerPreference && ['pap', 'en', 'nl', 'es'].includes(customerPreference)) {
    return customerPreference;
  }
  
  const lowerText = text.toLowerCase();
  const scores: Record<string, number> = { pap: 0, nl: 0, es: 0, en: 0 };
  
  for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
    for (const pattern of patterns) {
      if (lowerText.includes(pattern)) {
        scores[lang]++;
      }
    }
  }
  
  // Boost Papiamento as it's most common in Curaçao
  scores.pap *= 1.2;
  
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return 'pap'; // Default to Papiamento
  
  return Object.entries(scores).find(([, score]) => score === maxScore)?.[0] || 'pap';
}

// Detect intent from message
function detectIntent(text: string): { 
  intent: string; 
  isConfirmation: boolean; 
  isGreeting: boolean;
  isCancelOrder: boolean;
  isCancelItem: boolean;
  isAddition: boolean;
  isSameOrderResponse: boolean;
  isTomorrowResponse: boolean;
  isHumanEscalation: boolean;
  isComplaint: boolean;
  cancelItemName: string | null;
} {
  const lowerText = text.toLowerCase().trim();
  
  // Check for human escalation FIRST (highest priority)
  const isHumanEscalation = HUMAN_ESCALATION_PATTERNS.some(p => lowerText.includes(p));
  
  // Check for complaints (critical escalation)
  const isComplaint = COMPLAINT_PATTERNS.some(p => lowerText.includes(p)) && lowerText.length > 15;
  
  // Check for same order / tomorrow response
  const isSameOrderResponse = SAME_ORDER_PATTERNS.some(p => lowerText.includes(p));
  const isTomorrowResponse = TOMORROW_PATTERNS.some(p => lowerText.includes(p));
  
  // Check for order cancellation
  const isCancelOrder = CANCEL_PATTERNS.order.some(p => lowerText.includes(p));
  
  // Check for item cancellation (e.g., "cancel the salmon", "kita e salmon")
  let isCancelItem = false;
  let cancelItemName: string | null = null;
  if (!isCancelOrder) {
    for (const pattern of CANCEL_PATTERNS.item) {
      if (lowerText.includes(pattern)) {
        // Extract item name after cancel keyword
        const regex = new RegExp(`${pattern}\\s+(?:the\\s+|e\\s+|de\\s+|el\\s+|la\\s+)?(.+)`, 'i');
        const match = lowerText.match(regex);
        if (match && match[1]) {
          isCancelItem = true;
          cancelItemName = match[1].trim();
          break;
        }
      }
    }
  }
  
  // Check for addition
  const isAddition = ADDITION_PATTERNS.some(p => lowerText.includes(p));
  
  // Check for confirmation
  const confirmPatterns = ['si', 'sí', 'yes', 'ja', 'ok', 'okay', 'confirma', 'confirm', 'bevestig', 'ta bon', 'correcto', 'correct'];
  const isConfirmation = confirmPatterns.some(p => lowerText === p || lowerText.startsWith(p + ' ') || lowerText.endsWith(' ' + p));
  
  // Check for greeting with fuzzy matching (handles typos like bontardi, bonnochi)
  const greetingPatterns = [
    'bon dia', 'bondia', 'bon tardi', 'bontardi', 'bon nochi', 'bonnochi',
    'hola', 'hello', 'hi', 'hallo', 'buenos', 'good morning', 'good afternoon', 
    'goedemorgen', 'goedemiddag', 'goedenavond', 'kon ta', 'konta'
  ];
  const isGreeting = greetingPatterns.some(p => {
    // Exact match or fuzzy match (allow 1-2 character difference)
    if (lowerText.includes(p)) return true;
    // Simple fuzzy: check if pattern words appear in text
    const patternWords = p.split(' ');
    return patternWords.every(word => lowerText.includes(word.slice(0, 3)));
  });
  
  // Determine primary intent (order of priority matters!)
  let intent = 'order';
  if (isHumanEscalation) intent = 'human_escalation';
  else if (isComplaint) intent = 'complaint';
  else if (isSameOrderResponse) intent = 'same_order_today';
  else if (isTomorrowResponse) intent = 'for_tomorrow';
  else if (isCancelOrder) intent = 'cancel_order';
  else if (isCancelItem) intent = 'cancel_item';
  else if (isConfirmation) intent = 'confirm';
  else if (isAddition) intent = 'addition';
  else if (isGreeting && lowerText.length < 30) intent = 'greeting';
  
  return { intent, isConfirmation, isGreeting, isCancelOrder, isCancelItem, isAddition, isSameOrderResponse, isTomorrowResponse, isHumanEscalation, isComplaint, cancelItemName };
}

// Detect which team role should be escalated to
function detectEscalationRole(text: string): string | null {
  const lowerText = text.toLowerCase();
  
  for (const [role, triggers] of Object.entries(ESCALATION_TRIGGERS)) {
    if (triggers.some(t => lowerText.includes(t))) {
      return role;
    }
  }
  
  return 'logistics'; // Default to logistics for order modifications
}

// Parse order items from text
function parseOrderItems(text: string): Array<{ rawText: string; quantity: number; unit?: string }> {
  const items: Array<{ rawText: string; quantity: number; unit?: string }> = [];
  
  // Split by common delimiters
  const lines = text.split(/[,\n;]+/).map(l => l.trim()).filter(l => l.length > 0);
  
  for (const line of lines) {
    // Match patterns like "5 salmon", "10x tuna", "2 kg shrimp", "salmon 3"
    const patterns = [
      /^(\d+)\s*[xX]?\s*(.+)$/,           // "5 salmon" or "5x salmon"
      /^(.+?)\s+(\d+)\s*$/,                // "salmon 5"
      /^(\d+)\s*(kg|lb|pcs|box|case|caja|doos|stuk)?\s*(.+)$/i,  // "2 kg shrimp"
    ];
    
    let matched = false;
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        if (pattern === patterns[0]) {
          items.push({ rawText: match[2].trim(), quantity: parseInt(match[1]) });
        } else if (pattern === patterns[1]) {
          items.push({ rawText: match[1].trim(), quantity: parseInt(match[2]) });
        } else {
          items.push({ 
            rawText: match[3]?.trim() || match[2]?.trim() || '', 
            quantity: parseInt(match[1]),
            unit: match[2]?.toLowerCase()
          });
        }
        matched = true;
        break;
      }
    }
    
    // If no quantity found, assume 1
    if (!matched && line.length > 1) {
      items.push({ rawText: line, quantity: 1 });
    }
  }
  
  return items;
}

// Enhanced fuzzy match with aliases and dictionary support
function fuzzyMatchProductWithAliases(
  searchText: string, 
  products: Array<{ id: string; code: string; name: string; name_pap?: string; name_nl?: string; name_es?: string; price_xcg: number; unit?: string }>,
  aliases: Array<{ alias: string; product_id: string; language?: string }>,
  dictionary: Array<{ word: string; meaning: string; word_type: string }>
): { product: typeof products[0] | null; confidence: number; matchSource: string } {
  const search = searchText.toLowerCase().trim();
  
  // 1. FIRST CHECK: Exact alias match (highest priority - staff-trained mappings)
  for (const aliasEntry of aliases) {
    const alias = aliasEntry.alias.toLowerCase();
    if (alias === search || search.includes(alias) || alias.includes(search)) {
      const product = products.find(p => p.id === aliasEntry.product_id);
      if (product) {
        console.log(`Alias match: "${search}" → "${product.name}" via alias "${alias}"`);
        return { product, confidence: 1.0, matchSource: 'alias' };
      }
    }
  }
  
  // 2. SECOND CHECK: Dictionary translation (translate Dutch/Spanish/Papiamento to English)
  let translatedSearch = search;
  for (const entry of dictionary) {
    const word = entry.word.toLowerCase();
    // Only use product-related translations (nouns, not verbs/adjectives)
    if (entry.word_type === 'noun' || entry.word_type === 'product' || entry.word_type === 'phrase') {
      if (search === word || search.includes(word)) {
        // Use the meaning as the translation
        const translatedMeaning = entry.meaning.toLowerCase();
        translatedSearch = translatedSearch.replace(word, translatedMeaning);
        console.log(`Dictionary translation: "${word}" → "${translatedMeaning}"`);
      }
    }
  }
  
  // Try to match translated text
  if (translatedSearch !== search) {
    const translatedMatch = fuzzyMatchProductCore(translatedSearch, products);
    if (translatedMatch.product && translatedMatch.confidence >= 0.7) {
      console.log(`Dictionary-assisted match: "${search}" → "${translatedMatch.product.name}" (via translation)`);
      return { ...translatedMatch, matchSource: 'dictionary' };
    }
  }
  
  // 3. THIRD CHECK: Standard fuzzy matching
  const directMatch = fuzzyMatchProductCore(search, products);
  return { ...directMatch, matchSource: directMatch.product ? 'fuzzy' : 'none' };
}

// Core fuzzy matching logic (separated for reuse)
function fuzzyMatchProductCore(
  searchText: string, 
  products: Array<{ id: string; code: string; name: string; name_pap?: string; name_nl?: string; name_es?: string; price_xcg: number; unit?: string }>
): { product: typeof products[0] | null; confidence: number } {
  const search = searchText.toLowerCase().trim();
  
  let bestMatch: typeof products[0] | null = null;
  let bestScore = 0;
  
  for (const product of products) {
    const names = [
      product.name?.toLowerCase() || '',
      product.name_pap?.toLowerCase() || '',
      product.name_nl?.toLowerCase() || '',
      product.name_es?.toLowerCase() || '',
      product.code?.toLowerCase() || ''
    ].filter(n => n.length > 0);
    
    for (const name of names) {
      let score = 0;
      
      // Exact match
      if (name === search) {
        score = 1;
      }
      // Contains full search term
      else if (name.includes(search)) {
        score = 0.9;
      }
      // Search contains product name
      else if (search.includes(name)) {
        score = 0.85;
      }
      // Word-level matching
      else {
        const searchWords = search.split(/\s+/);
        const nameWords = name.split(/\s+/);
        const matchedWords = searchWords.filter(sw => 
          nameWords.some(nw => nw.includes(sw) || sw.includes(nw))
        );
        score = matchedWords.length / Math.max(searchWords.length, nameWords.length) * 0.7;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = product;
      }
    }
  }
  
  return { product: bestMatch, confidence: bestScore };
}

// Legacy wrapper for backward compatibility
function fuzzyMatchProduct(
  searchText: string, 
  products: Array<{ id: string; code: string; name: string; name_pap?: string; name_nl?: string; name_es?: string; price_xcg: number; unit?: string }>
): { product: typeof products[0] | null; confidence: number } {
  return fuzzyMatchProductCore(searchText, products);
}

// Build conversation snapshot for order
function buildConversationSnapshot(messages: Array<{ direction: string; message_text: string; created_at: string }>): string {
  return messages.map(m => {
    const prefix = m.direction === 'inbound' ? '👤 Customer' : '🤖 FUIK';
    const time = new Date(m.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `[${time}] ${prefix}: ${m.message_text}`;
  }).join('\n');
}

// Get team member by role from profiles
// deno-lint-ignore no-explicit-any
async function getTeamMemberByRole(supabase: any, role: string): Promise<{ name: string; phone: string } | null> {
  const { data: teamMember } = await supabase
    .from('profiles')
    .select('full_name, whatsapp_phone')
    .eq('is_fuik_team', true)
    .eq('team_role', role)
    .limit(1)
    .single();
  
  if (teamMember && (teamMember as { whatsapp_phone?: string }).whatsapp_phone) {
    const tm = teamMember as { full_name?: string; whatsapp_phone: string };
    return { name: tm.full_name || role, phone: tm.whatsapp_phone };
  }
  
  return null;
}

// Check if order has items being picked
// deno-lint-ignore no-explicit-any
async function checkOrderPickingStatus(supabase: any, orderId: string): Promise<boolean> {
  const { data: items } = await supabase
    .from('distribution_order_items')
    .select('picked_quantity')
    .eq('order_id', orderId)
    .eq('is_cancelled', false);
  
  // Order is in picking if any item has been picked
  if (!items) return false;
  return (items as Array<{ picked_quantity?: number }>).some(item => (item.picked_quantity || 0) > 0);
}

// Get unpicked orders for today
// deno-lint-ignore no-explicit-any
async function getUnpickedOrdersToday(
  supabase: any, 
  customerId: string | null, 
  customerPhone: string
): Promise<Array<{ id: string; order_number: string; status: string; created_at: string; total_xcg: number }>> {
  // Get today's date in Curaçao timezone
  const today = new Date();
  const curacaoOffset = -4 * 60; // UTC-4
  const localOffset = today.getTimezoneOffset();
  const curacaoTime = new Date(today.getTime() + (localOffset - curacaoOffset) * 60000);
  const startOfDay = new Date(curacaoTime);
  startOfDay.setHours(0, 0, 0, 0);
  
  let query = supabase
    .from('distribution_orders')
    .select('id, order_number, status, created_at, total_xcg')
    .in('status', ['pending', 'confirmed'])
    .gte('created_at', startOfDay.toISOString())
    .order('created_at', { ascending: true });
  
  if (customerId) {
    query = query.eq('customer_id', customerId);
  } else {
    query = query.eq('customer_phone', customerPhone);
  }
  
  const { data: orders } = await query;
  
  if (!orders) return [];
  
  // Filter out orders that have items already picked
  const unpickedOrders: Array<{ id: string; order_number: string; status: string; created_at: string; total_xcg: number }> = [];
  
  for (const order of orders as Array<{ id: string; order_number: string; status: string; created_at: string; total_xcg: number }>) {
    const isPicking = await checkOrderPickingStatus(supabase, order.id);
    if (!isPicking) {
      unpickedOrders.push(order);
    }
  }
  
  return unpickedOrders;
}

// Send WhatsApp message via Meta API
async function sendWhatsAppMessage(phoneNumber: string, message: string): Promise<boolean> {
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  
  if (!accessToken || !phoneNumberId) {
    console.error('WhatsApp credentials not configured');
    return false;
  }
  
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phoneNumber.replace(/\D/g, ''),
          type: 'text',
          text: { body: message }
        }),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('WhatsApp API error:', errorText);
      return false;
    }
    
    console.log('WhatsApp message sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      customer_id, 
      customer_name,
      customer_phone, 
      message_text, 
      message_id,
      preferred_language 
    } = await req.json();

    console.log('AI Agent processing:', { customer_id, customer_phone, message_text, preferred_language });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Detect language
    const language = detectLanguage(message_text, preferred_language);
    console.log('Detected language:', language);

    // Detect intent
    const { intent, isConfirmation, isGreeting, isCancelOrder, isCancelItem, isAddition, isSameOrderResponse, isTomorrowResponse, isHumanEscalation, isComplaint, cancelItemName } = detectIntent(message_text);
    console.log('Detected intent:', intent, { isConfirmation, isGreeting, isCancelOrder, isCancelItem, isAddition, isSameOrderResponse, isTomorrowResponse, isHumanEscalation, isComplaint, cancelItemName });

    // Handle HUMAN ESCALATION request first (highest priority)
    if (isHumanEscalation) {
      console.log('Customer requesting human escalation');
      
      // Send acknowledgment to customer
      const customerMsg = RESPONSE_TEMPLATES.human_escalation[language as keyof typeof RESPONSE_TEMPLATES.human_escalation];
      await sendWhatsAppMessage(customer_phone, customerMsg);
      
      // Get management team member to notify
      const teamMember = await getTeamMemberByRole(supabase, 'management');
      
      if (teamMember) {
        // Send notification to team
        const teamMsg = RESPONSE_TEMPLATES.human_escalation_team[language as keyof typeof RESPONSE_TEMPLATES.human_escalation_team]
          .replace('{customer_name}', customer_name || 'Unknown')
          .replace('{phone}', customer_phone)
          .replace('{message}', message_text.substring(0, 200));
        
        await sendWhatsAppMessage(teamMember.phone, teamMsg);
        
        // Log both messages
        await supabase.from('whatsapp_messages').insert([
          {
            direction: 'outbound',
            phone_number: customer_phone,
            message_text: customerMsg,
            customer_id: customer_id || null,
            status: 'sent'
          },
          {
            direction: 'outbound',
            phone_number: teamMember.phone,
            message_text: teamMsg,
            customer_id: null,
            status: 'sent'
          }
        ]);
      } else {
        // No team member configured, just log customer message
        await supabase.from('whatsapp_messages').insert({
          direction: 'outbound',
          phone_number: customer_phone,
          message_text: customerMsg,
          customer_id: customer_id || null,
          status: 'sent'
        });
      }
      
      // Create notification for management in-app
      const { data: admins } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'management']);
      
      if (admins && admins.length > 0) {
        const notifications = admins.map((admin: { user_id: string }) => ({
          user_id: admin.user_id,
          type: 'escalation',
          title: 'Human Escalation Request',
          message: `Customer ${customer_name || customer_phone} requested to speak with a person. Original message: "${message_text.substring(0, 100)}..."`,
          is_read: false
        }));
        
        await supabase.from('notifications').insert(notifications);
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        action: 'human_escalation',
        customer_phone,
        notified_team: !!teamMember
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle COMPLAINT escalation (critical - direct message to management)
    if (isComplaint) {
      console.log('Customer complaint detected - escalating to management');
      
      // Get recent order info for context
      const { data: recentOrderForComplaint } = await supabase
        .from('distribution_orders')
        .select('id, order_number, status, created_at')
        .or(customer_id ? `customer_id.eq.${customer_id},customer_phone.eq.${customer_phone}` : `customer_phone.eq.${customer_phone}`)
        .order('created_at', { ascending: false })
        .limit(1);
      
      const orderInfo = recentOrderForComplaint?.[0] 
        ? `${recentOrderForComplaint[0].order_number} (${recentOrderForComplaint[0].status})`
        : 'No recent order';
      
      // Send acknowledgment to customer
      const customerMsgTemplate = RESPONSE_TEMPLATES.complaint_customer[language as keyof typeof RESPONSE_TEMPLATES.complaint_customer];
      const customerMsg = customerMsgTemplate.replace('{customer_name}', customer_name?.split(' ')[0] || 'friend');
      await sendWhatsAppMessage(customer_phone, customerMsg);
      
      // Get management team member to notify
      const teamMember = await getTeamMemberByRole(supabase, 'management');
      
      if (teamMember) {
        // Send detailed complaint to management
        const teamMsgTemplate = RESPONSE_TEMPLATES.complaint_team[language as keyof typeof RESPONSE_TEMPLATES.complaint_team];
        const teamMsg = teamMsgTemplate
          .replace('{customer_name}', customer_name || 'Unknown Customer')
          .replace('{phone}', customer_phone)
          .replace('{message}', message_text.substring(0, 300))
          .replace('{order_info}', orderInfo);
        
        await sendWhatsAppMessage(teamMember.phone, teamMsg);
        console.log('Complaint notification sent to management:', teamMember.name);
        
        // Log both messages
        await supabase.from('whatsapp_messages').insert([
          {
            direction: 'outbound',
            phone_number: customer_phone,
            message_text: customerMsg,
            customer_id: customer_id || null,
            status: 'sent'
          },
          {
            direction: 'outbound',
            phone_number: teamMember.phone,
            message_text: teamMsg,
            customer_id: null,
            status: 'sent'
          }
        ]);
      } else {
        // No team member configured, just log customer message
        console.warn('No management team member configured for complaint escalation');
        await supabase.from('whatsapp_messages').insert({
          direction: 'outbound',
          phone_number: customer_phone,
          message_text: customerMsg,
          customer_id: customer_id || null,
          status: 'sent'
        });
      }
      
      // Create in-app notification for admins/management
      const { data: admins } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'management']);
      
      if (admins && admins.length > 0) {
        const notifications = admins.map((admin: { user_id: string }) => ({
          user_id: admin.user_id,
          type: 'complaint',
          title: '⚠️ Customer Complaint',
          message: `${customer_name || customer_phone}: "${message_text.substring(0, 150)}..." - Order: ${orderInfo}`,
          is_read: false
        }));
        
        await supabase.from('notifications').insert(notifications);
      }
      
      // Store conversation
      await supabase.from('distribution_conversations').insert({
        customer_id: customer_id || null,
        direction: 'outbound',
        message_text: customerMsg,
        detected_language: language,
        parsed_intent: 'complaint_escalation'
      });
      
      return new Response(JSON.stringify({ 
        success: true, 
        action: 'complaint_escalation',
        customer_phone,
        notified_team: !!teamMember,
        order_info: orderInfo
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get products, aliases, and dictionary for intelligent matching
    const [productsResult, aliasesResult, dictionaryResult] = await Promise.all([
      supabase
        .from('distribution_products')
        .select('id, code, name, name_pap, name_nl, name_es, price_xcg, unit')
        .eq('is_active', true),
      supabase
        .from('distribution_product_aliases')
        .select('alias, product_id, language'),
      supabase
        .from('distribution_context_words')
        .select('word, meaning, word_type')
        .in('word_type', ['noun', 'product', 'phrase'])
        .limit(500)
    ]);
    
    const products = productsResult.data || [];
    const aliases = aliasesResult.data || [];
    const dictionary = dictionaryResult.data || [];
    
    console.log(`Loaded ${products.length} products, ${aliases.length} aliases, ${dictionary.length} dictionary words`);

    if (products.length === 0) {
      console.error('No products found in database');
      return new Response(JSON.stringify({ error: 'No products available' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if this is a NEW customer (no customer_id)
    const isNewCustomer = !customer_id;
    
    // Get recent orders for this customer/phone for modifications
    const { data: recentOrders } = await supabase
      .from('distribution_orders')
      .select('id, order_number, status, created_at, cancellation_cutoff_hours, total_xcg')
      .or(customer_id ? `customer_id.eq.${customer_id},customer_phone.eq.${customer_phone}` : `customer_phone.eq.${customer_phone}`)
      .in('status', ['pending', 'confirmed', 'picking'])
      .order('created_at', { ascending: false })
      .limit(1);
    
    const recentOrder = recentOrders?.[0] || null;
    const cutoffHours = recentOrder?.cancellation_cutoff_hours || 2;

    // Check if order is in picking phase (items being picked)
    const isOrderInPicking = recentOrder ? await checkOrderPickingStatus(supabase, recentOrder.id) : false;

    // Handle ORDER CANCELLATION
    if (isCancelOrder && recentOrder) {
      console.log('Processing order cancellation');
      
      const orderAge = (Date.now() - new Date(recentOrder.created_at).getTime()) / (1000 * 60 * 60);
      
      if (orderAge > cutoffHours) {
        // Too late to cancel automatically
        const msg = RESPONSE_TEMPLATES.cancel_too_late[language as keyof typeof RESPONSE_TEMPLATES.cancel_too_late]
          .replace('{hours}', cutoffHours.toString());
        await sendWhatsAppMessage(customer_phone, msg);
        
        return new Response(JSON.stringify({ 
          success: true, 
          action: 'cancel_rejected_time',
          order_id: recentOrder.id
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Cancel all items (mark as cancelled, don't delete)
      await supabase
        .from('distribution_order_items')
        .update({ 
          is_cancelled: true, 
          cancelled_at: new Date().toISOString(),
          cancelled_by: 'whatsapp_customer',
          cancellation_reason: 'Customer requested via WhatsApp'
        })
        .eq('order_id', recentOrder.id);
      
      // Update order status
      await supabase
        .from('distribution_orders')
        .update({ 
          status: 'cancelled',
          notes: `Cancelled by customer via WhatsApp at ${new Date().toISOString()}`
        })
        .eq('id', recentOrder.id);
      
      const msg = RESPONSE_TEMPLATES.cancel_order_success[language as keyof typeof RESPONSE_TEMPLATES.cancel_order_success];
      await sendWhatsAppMessage(customer_phone, msg);
      
      await supabase.from('whatsapp_messages').insert({
        direction: 'outbound',
        phone_number: customer_phone,
        message_text: msg,
        customer_id: customer_id || null,
        status: 'sent'
      });
      
      return new Response(JSON.stringify({ 
        success: true, 
        action: 'order_cancelled',
        order_id: recentOrder.id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle ITEM CANCELLATION
    if (isCancelItem && cancelItemName && recentOrder) {
      console.log('Processing item cancellation:', cancelItemName);
      
      const orderAge = (Date.now() - new Date(recentOrder.created_at).getTime()) / (1000 * 60 * 60);
      
      if (orderAge > cutoffHours) {
        const msg = RESPONSE_TEMPLATES.cancel_too_late[language as keyof typeof RESPONSE_TEMPLATES.cancel_too_late]
          .replace('{hours}', cutoffHours.toString());
        await sendWhatsAppMessage(customer_phone, msg);
        
        return new Response(JSON.stringify({ 
          success: true, 
          action: 'cancel_item_rejected_time'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Find matching product
      const { product: matchedProduct } = fuzzyMatchProduct(cancelItemName, products);
      
      if (matchedProduct) {
        // Mark item as cancelled
        const { data: cancelledItems } = await supabase
          .from('distribution_order_items')
          .update({ 
            is_cancelled: true, 
            cancelled_at: new Date().toISOString(),
            cancelled_by: 'whatsapp_customer',
            cancellation_reason: 'Customer requested via WhatsApp'
          })
          .eq('order_id', recentOrder.id)
          .eq('product_id', matchedProduct.id)
          .eq('is_cancelled', false)
          .select();
        
        if (cancelledItems && cancelledItems.length > 0) {
          // Recalculate order total (excluding cancelled items)
          const { data: remainingItems } = await supabase
            .from('distribution_order_items')
            .select('total_xcg')
            .eq('order_id', recentOrder.id)
            .eq('is_cancelled', false);
          
          const newTotal = remainingItems?.reduce((sum, item) => sum + (item.total_xcg || 0), 0) || 0;
          
          await supabase
            .from('distribution_orders')
            .update({ total_xcg: newTotal })
            .eq('id', recentOrder.id);
          
          const msg = RESPONSE_TEMPLATES.cancel_item_success[language as keyof typeof RESPONSE_TEMPLATES.cancel_item_success]
            .replace('{item}', matchedProduct.name);
          await sendWhatsAppMessage(customer_phone, msg);
          
          await supabase.from('whatsapp_messages').insert({
            direction: 'outbound',
            phone_number: customer_phone,
            message_text: msg,
            customer_id: customer_id || null,
            status: 'sent'
          });
          
          return new Response(JSON.stringify({ 
            success: true, 
            action: 'item_cancelled',
            product_name: matchedProduct.name,
            order_id: recentOrder.id
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      
      // Product not found in order
      const msg = getNoMatchResponse(language, cancelItemName);
      await sendWhatsAppMessage(customer_phone, msg);
      
      return new Response(JSON.stringify({ 
        success: true, 
        action: 'cancel_item_not_found'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle SAME ORDER TODAY response - link to existing order
    if (isSameOrderResponse) {
      console.log('Customer confirmed same order for today');
      
      // Get the pending items from recent conversation
      const { data: recentConvo } = await supabase
        .from('distribution_conversations')
        .select('parsed_items')
        .or(customer_id ? `customer_id.eq.${customer_id}` : `message_text.ilike.%${customer_phone}%`)
        .eq('direction', 'outbound')
        .eq('parsed_intent', 'pending_same_day_question')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (recentConvo?.[0]?.parsed_items) {
        // Store as addition recap so confirmation creates linked order
        await supabase.from('distribution_conversations').insert({
          customer_id: customer_id || null,
          direction: 'outbound',
          message_text: 'Same order today confirmed',
          detected_language: language,
          parsed_intent: 'addition_recap',
          parsed_items: recentConvo[0].parsed_items
        });
        
        // Send confirmation request
        const parsedItems = recentConvo[0].parsed_items as Array<{ product_name: string; quantity: number; unit_price: number }>;
        const itemsList = parsedItems.map(item => 
          `• ${item.quantity}x ${item.product_name}`
        ).join('\n');
        
        const recapMsg = RESPONSE_TEMPLATES.order_recap[language as keyof typeof RESPONSE_TEMPLATES.order_recap]
          .replace('{items}', itemsList) + 
          (language === 'pap' ? '\n\n📦 Esaki lo wordo agregá na bo orden di awe.' :
           language === 'nl' ? '\n\n📦 Dit wordt toegevoegd aan uw bestelling van vandaag.' :
           language === 'es' ? '\n\n📦 Esto se agregará a tu pedido de hoy.' :
           '\n\n📦 This will be added to your order for today.');
        
        await sendWhatsAppMessage(customer_phone, recapMsg);
        
        return new Response(JSON.stringify({ 
          success: true, 
          action: 'same_order_confirmed_pending_final_confirmation'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Handle TOMORROW response - create new order for tomorrow
    if (isTomorrowResponse) {
      console.log('Customer wants order for tomorrow');
      
      // Get the pending items from recent conversation
      const { data: recentConvo } = await supabase
        .from('distribution_conversations')
        .select('parsed_items')
        .or(customer_id ? `customer_id.eq.${customer_id}` : `message_text.ilike.%${customer_phone}%`)
        .eq('direction', 'outbound')
        .eq('parsed_intent', 'pending_same_day_question')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (recentConvo?.[0]?.parsed_items) {
        // Store as order recap (not addition) so it creates new order
        await supabase.from('distribution_conversations').insert({
          customer_id: customer_id || null,
          direction: 'outbound',
          message_text: 'Order for tomorrow confirmed',
          detected_language: language,
          parsed_intent: 'order_recap',
          parsed_items: recentConvo[0].parsed_items
        });
        
        // Send confirmation request
        const parsedItems = recentConvo[0].parsed_items as Array<{ product_name: string; quantity: number; unit_price: number }>;
        const itemsList = parsedItems.map(item => 
          `• ${item.quantity}x ${item.product_name}`
        ).join('\n');
        
        const recapMsg = RESPONSE_TEMPLATES.order_recap[language as keyof typeof RESPONSE_TEMPLATES.order_recap]
          .replace('{items}', itemsList) + 
          (language === 'pap' ? '\n\n📅 Esaki ta pa mañan.' :
           language === 'nl' ? '\n\n📅 Dit is voor morgen.' :
           language === 'es' ? '\n\n📅 Esto es para mañana.' :
           '\n\n📅 This is for tomorrow.');
        
        await sendWhatsAppMessage(customer_phone, recapMsg);
        
        return new Response(JSON.stringify({ 
          success: true, 
          action: 'tomorrow_order_pending_confirmation'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Handle confirmation - create order from previous conversation
    if (isConfirmation) {
      console.log('Processing order confirmation');
      
      // Get recent conversation to find parsed items
      const { data: recentConvo } = await supabase
        .from('distribution_conversations')
        .select('parsed_items, parsed_intent')
        .or(customer_id ? `customer_id.eq.${customer_id}` : `message_text.ilike.%${customer_phone}%`)
        .eq('direction', 'outbound')
        .in('parsed_intent', ['order_recap', 'addition_recap'])
        .order('created_at', { ascending: false })
        .limit(5);
      
      // Find the most recent recap with parsed items
      let parsedItems: Array<{ product_id: string; product_name: string; quantity: number; unit_price: number }> = [];
      let isAdditionConfirmation = false;
      
      for (const convo of recentConvo || []) {
        if (convo.parsed_items && Array.isArray(convo.parsed_items) && convo.parsed_items.length > 0) {
          parsedItems = convo.parsed_items as Array<{ product_id: string; product_name: string; quantity: number; unit_price: number }>;
          isAdditionConfirmation = convo.parsed_intent === 'addition_recap';
          break;
        }
      }
      
      if (parsedItems.length > 0) {
        // Get conversation snapshot for order
        const { data: conversationMessages } = await supabase
          .from('whatsapp_messages')
          .select('direction, message_text, created_at')
          .eq('phone_number', customer_phone)
          .order('created_at', { ascending: false })
          .limit(20);
        
        const conversationSnapshot = buildConversationSnapshot(
          (conversationMessages || []).reverse()
        );
        
        // Get the oldest unpicked order for today if this is an addition
        let parentOrderId: string | null = null;
        if (isAdditionConfirmation) {
          const unpickedOrders = await getUnpickedOrdersToday(supabase, customer_id, customer_phone);
          if (unpickedOrders.length > 0) {
            parentOrderId = unpickedOrders[0].id;
          }
        }
        
        // Create the order (or linked sub-order for additions)
        const orderNumber = `WA-${Date.now().toString(36).toUpperCase()}`;
        const totalAmount = parsedItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        
        const orderData: Record<string, unknown> = {
          order_number: orderNumber,
          customer_id: customer_id || null,
          customer_phone: customer_phone,
          status: 'pending',
          source: 'whatsapp',
          total_xcg: totalAmount,
          source_conversation: conversationSnapshot,
          notes: isNewCustomer ? `New WhatsApp customer - needs customer assignment. Phone: ${customer_phone}` : null
        };
        
        // If this is an addition to existing order, link it
        if (isAdditionConfirmation && parentOrderId) {
          orderData.parent_order_id = parentOrderId;
          orderData.modification_type = 'addition';
          
          // Get parent order number for note
          const { data: parentOrder } = await supabase
            .from('distribution_orders')
            .select('order_number')
            .eq('id', parentOrderId)
            .single();
          
          orderData.notes = `Addition to order ${parentOrder?.order_number || parentOrderId}`;
        }
        
        const { data: order, error: orderError } = await supabase
          .from('distribution_orders')
          .insert(orderData)
          .select()
          .single();

        if (orderError) {
          console.error('Error creating order:', orderError);
        } else {
          console.log('Order created:', order.id);
          
          // Create order items
          const orderItems = parsedItems.map(item => ({
            order_id: order.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price_xcg: item.unit_price,
            total_xcg: item.quantity * item.unit_price
          }));
          
          const { error: itemsError } = await supabase
            .from('distribution_order_items')
            .insert(orderItems);
          
          if (itemsError) {
            console.error('Error creating order items:', itemsError);
          }
          
          // Check if this order is a response to Dre's proactive outreach
          let dreOutreachId: string | null = null;
          if (customer_id) {
            const today = new Date().toISOString().split('T')[0];
            const { data: recentOutreach } = await supabase
              .from('dre_outreach_log')
              .select('id, outreach_type')
              .eq('customer_id', customer_id)
              .eq('status', 'sent')
              .gte('sent_at', `${today}T00:00:00`)
              .order('sent_at', { ascending: false })
              .limit(1);
            
            if (recentOutreach && recentOutreach.length > 0) {
              dreOutreachId = recentOutreach[0].id;
              console.log('Order attributed to Dre outreach:', dreOutreachId);
              
              // Update outreach log with conversion
              await supabase
                .from('dre_outreach_log')
                .update({
                  customer_responded: true,
                  response_at: new Date().toISOString(),
                  order_generated_id: order.id,
                  order_revenue: totalAmount,
                  status: 'converted'
                })
                .eq('id', dreOutreachId);
              
              // Link order to outreach
              await supabase
                .from('distribution_orders')
                .update({ dre_outreach_id: dreOutreachId })
                .eq('id', order.id);
            }
          }
          
          // Send confirmation
          const template = isAdditionConfirmation ? RESPONSE_TEMPLATES.addition_confirmed : RESPONSE_TEMPLATES.order_confirmed;
          const confirmMsg = template[language as keyof typeof template];
          await sendWhatsAppMessage(customer_phone, confirmMsg);
          
          // Store outbound message
          await supabase.from('whatsapp_messages').insert({
            direction: 'outbound',
            phone_number: customer_phone,
            message_text: confirmMsg,
            customer_id: customer_id || null,
            status: 'sent'
          });
          
          // Clear parsed items from recent conversations to prevent duplicate orders
          // We do this by storing a marker
          await supabase.from('distribution_conversations').insert({
            customer_id: customer_id || null,
            direction: 'outbound',
            message_text: confirmMsg,
            detected_language: language,
            parsed_intent: 'order_confirmed',
            order_id: order.id
          });
          
          return new Response(JSON.stringify({ 
            success: true, 
            action: isAdditionConfirmation ? 'addition_confirmed' : 'order_confirmed',
            order_id: order.id,
            order_number: orderNumber,
            parent_order_id: parentOrderId,
            customer_id: customer_id || null,
            is_new_customer: isNewCustomer,
            dre_attributed: !!dreOutreachId
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Handle greeting
    if (isGreeting && !message_text.match(/\d/)) {
      let response: string;
      
      if (isNewCustomer) {
        // Welcome new customer
        response = RESPONSE_TEMPLATES.welcome_new[language as keyof typeof RESPONSE_TEMPLATES.welcome_new];
      } else {
        response = RESPONSE_TEMPLATES.greeting_response[language as keyof typeof RESPONSE_TEMPLATES.greeting_response];
      }
      
      await sendWhatsAppMessage(customer_phone, response);
      
      await supabase.from('whatsapp_messages').insert({
        direction: 'outbound',
        phone_number: customer_phone,
        message_text: response,
        customer_id: customer_id || null,
        status: 'sent'
      });
      
      // Store conversation
      await supabase.from('distribution_conversations').insert({
        customer_id: customer_id || null,
        direction: 'outbound',
        message_text: response,
        detected_language: language,
        parsed_intent: 'greeting'
      });
      
      return new Response(JSON.stringify({ 
        success: true, 
        action: 'greeting',
        is_new_customer: isNewCustomer
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for pending order session (incomplete order from earlier)
    const { data: pendingSession } = await supabase
      .from('distribution_order_sessions')
      .select('*')
      .eq('customer_phone', customer_phone)
      .eq('status', 'pending_confirmation')
      .order('created_at', { ascending: false })
      .limit(1);
    
    // If customer is responding to a reminder, treat confirmation properly
    if (pendingSession?.[0] && isConfirmation) {
      console.log('Customer confirming pending session from reminder');
      
      const session = pendingSession[0];
      const sessionItems = (session.parsed_items || []) as Array<{ product_id: string; product_name: string; quantity: number; unit_price: number }>;
      
      if (sessionItems.length > 0) {
        // Mark session as confirmed
        await supabase
          .from('distribution_order_sessions')
          .update({ status: 'confirmed', updated_at: new Date().toISOString() })
          .eq('id', session.id);
        
        // Create order from session
        const orderNumber = `WA-${Date.now().toString(36).toUpperCase()}`;
        const totalAmount = sessionItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        
        const { data: order, error: orderError } = await supabase
          .from('distribution_orders')
          .insert({
            order_number: orderNumber,
            customer_id: session.customer_id || null,
            customer_phone: customer_phone,
            status: 'pending',
            source: 'whatsapp',
            total_xcg: totalAmount,
            source_conversation: JSON.stringify(session.conversation_snapshot),
            notes: !session.customer_id ? `New WhatsApp customer - needs customer assignment. Phone: ${customer_phone}` : null
          })
          .select()
          .single();
        
        if (!orderError && order) {
          const orderItems = sessionItems.map(item => ({
            order_id: order.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price_xcg: item.unit_price,
            total_xcg: item.quantity * item.unit_price
          }));
          
          await supabase.from('distribution_order_items').insert(orderItems);
          
          const confirmMsg = RESPONSE_TEMPLATES.order_confirmed[language as keyof typeof RESPONSE_TEMPLATES.order_confirmed];
          await sendWhatsAppMessage(customer_phone, confirmMsg);
          
          await supabase.from('whatsapp_messages').insert({
            direction: 'outbound',
            phone_number: customer_phone,
            message_text: confirmMsg,
            customer_id: session.customer_id || null,
            status: 'sent'
          });
          
          return new Response(JSON.stringify({ 
            success: true, 
            action: 'session_order_confirmed',
            order_id: order.id,
            order_number: orderNumber,
            session_id: session.id
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }
    
    // If customer says "No" to reminder, abandon the session
    const noPatterns = ['no', 'nee', 'nein', 'cancel', 'kansela', 'annuleer', 'cancelar'];
    if (pendingSession?.[0] && noPatterns.some(p => message_text.toLowerCase().trim() === p)) {
      await supabase
        .from('distribution_order_sessions')
        .update({ status: 'abandoned', updated_at: new Date().toISOString() })
        .eq('id', pendingSession[0].id);
      
      const abandonMsg = language === 'pap' ? "👍 Ok, bo orden a wordo kanselá. Avisami ora bo ke pidi algo nobo!" :
                        language === 'nl' ? "👍 Oké, uw bestelling is geannuleerd. Laat me weten als u iets nieuws wilt bestellen!" :
                        language === 'es' ? "👍 Ok, tu pedido ha sido cancelado. ¡Avísame cuando quieras pedir algo nuevo!" :
                        "👍 Ok, your order has been cancelled. Let me know when you'd like to order something new!";
      
      await sendWhatsAppMessage(customer_phone, abandonMsg);
      
      return new Response(JSON.stringify({ 
        success: true, 
        action: 'session_abandoned',
        session_id: pendingSession[0].id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse order items
    const parsedItems = parseOrderItems(message_text);
    console.log('Parsed items:', parsedItems);

    if (parsedItems.length === 0) {
      // Check if they're trying to cancel but no order found
      if ((isCancelOrder || isCancelItem) && !recentOrder) {
        const msg = RESPONSE_TEMPLATES.no_recent_order[language as keyof typeof RESPONSE_TEMPLATES.no_recent_order];
        await sendWhatsAppMessage(customer_phone, msg);
        
        return new Response(JSON.stringify({ 
          success: true, 
          action: 'no_order_to_cancel'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // No items found, send welcome/help message
      let response: string;
      if (isNewCustomer) {
        response = RESPONSE_TEMPLATES.welcome_new[language as keyof typeof RESPONSE_TEMPLATES.welcome_new];
      } else {
        response = RESPONSE_TEMPLATES.greeting_response[language as keyof typeof RESPONSE_TEMPLATES.greeting_response];
      }
      
      await sendWhatsAppMessage(customer_phone, response);
      
      return new Response(JSON.stringify({ 
        success: true, 
        action: 'help',
        is_new_customer: isNewCustomer
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Match products using enhanced matching with aliases and dictionary
    const matchedItems: Array<{ 
      product_id: string; 
      product_name: string; 
      quantity: number; 
      unit_price: number;
      confidence: number;
      matchSource: string;
    }> = [];
    const unmatchedItems: string[] = [];

    for (const item of parsedItems) {
      // Use enhanced matching with aliases and dictionary
      const { product, confidence, matchSource } = fuzzyMatchProductWithAliases(
        item.rawText, 
        products, 
        aliases, 
        dictionary
      );
      
      if (product && confidence >= 0.5) {
        matchedItems.push({
          product_id: product.id,
          product_name: product.name,
          quantity: item.quantity,
          unit_price: product.price_xcg || 0,
          confidence,
          matchSource
        });
        
        // Log AI match with source tracking
        await supabase.from('distribution_ai_match_logs').insert({
          raw_text: item.rawText,
          matched_product_id: product.id,
          customer_id: customer_id || null,
          confidence: confidence >= 0.8 ? 'high' : confidence >= 0.6 ? 'medium' : 'low',
          detected_quantity: item.quantity,
          detected_language: language,
          needs_review: confidence < 0.7 && matchSource !== 'alias', // Alias matches don't need review
          match_source: matchSource
        });
        
        console.log(`Matched "${item.rawText}" → "${product.name}" (${matchSource}, confidence: ${confidence})`);
      } else {
        unmatchedItems.push(item.rawText);
        console.log(`No match for "${item.rawText}"`);
      }
    }

    // Check for existing unpicked orders today (same-day duplicate detection)
    const unpickedOrdersToday = await getUnpickedOrdersToday(supabase, customer_id, customer_phone);
    
    // If customer has unpicked order today and this isn't explicitly an addition, ask
    if (unpickedOrdersToday.length > 0 && !isAddition && matchedItems.length > 0) {
      const existingOrder = unpickedOrdersToday[0];
      
      // Store parsed items for later use
      await supabase.from('distribution_conversations').insert({
        customer_id: customer_id || null,
        direction: 'outbound',
        message_text: 'Pending same day question',
        detected_language: language,
        parsed_intent: 'pending_same_day_question',
        parsed_items: matchedItems
      });
      
      // Ask if this is for the same order or tomorrow
      const askMsg = RESPONSE_TEMPLATES.existing_order_today[language as keyof typeof RESPONSE_TEMPLATES.existing_order_today]
        .replace('{order_number}', existingOrder.order_number);
      
      await sendWhatsAppMessage(customer_phone, askMsg);
      
      await supabase.from('whatsapp_messages').insert({
        direction: 'outbound',
        phone_number: customer_phone,
        message_text: askMsg,
        customer_id: customer_id || null,
        status: 'sent'
      });
      
      return new Response(JSON.stringify({ 
        success: true, 
        action: 'asked_same_day_or_tomorrow',
        existing_order_id: existingOrder.id,
        existing_order_number: existingOrder.order_number,
        matched_items: matchedItems.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if order is in picking and customer wants modifications - ESCALATE
    if (isOrderInPicking && (isAddition || isCancelItem) && recentOrder) {
      console.log('Order is in picking, escalating to team');
      
      const escalationRole = detectEscalationRole(message_text);
      const teamMember = await getTeamMemberByRole(supabase, escalationRole || 'logistics');
      
      if (teamMember) {
        const actionText = isAddition ? 
          (language === 'pap' ? 'agrega produkto' : language === 'nl' ? 'product toevoegen' : language === 'es' ? 'agregar producto' : 'add product') :
          (language === 'pap' ? 'kansela produkto' : language === 'nl' ? 'product annuleren' : language === 'es' ? 'cancelar producto' : 'cancel product');
        
        // Send message to customer about escalation
        const customerMsg = RESPONSE_TEMPLATES.escalation_picking[language as keyof typeof RESPONSE_TEMPLATES.escalation_picking]
          .replace('{team_member}', teamMember.name)
          .replace('{role}', escalationRole || 'Logistics')
          .replace('{action}', actionText);
        
        await sendWhatsAppMessage(customer_phone, customerMsg);
        
        // Send notification to team member
        const teamMsg = RESPONSE_TEMPLATES.escalation_team_notification[language as keyof typeof RESPONSE_TEMPLATES.escalation_team_notification]
          .replace('{team_member}', teamMember.name)
          .replace('{customer_name}', customer_name || customer_phone)
          .replace('{request}', message_text)
          .replace('{order_number}', recentOrder.order_number)
          .replace('{status}', recentOrder.status);
        
        await sendWhatsAppMessage(teamMember.phone, teamMsg);
        
        // Log the escalation
        await supabase.from('whatsapp_messages').insert([
          {
            direction: 'outbound',
            phone_number: customer_phone,
            message_text: customerMsg,
            customer_id: customer_id || null,
            status: 'sent'
          },
          {
            direction: 'outbound',
            phone_number: teamMember.phone,
            message_text: teamMsg,
            customer_id: null,
            status: 'sent'
          }
        ]);
        
        return new Response(JSON.stringify({ 
          success: true, 
          action: 'escalated_to_team',
          team_member: teamMember.name,
          team_role: escalationRole,
          order_id: recentOrder.id
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Build response
    let responseMessage = '';
    const intentType = isAddition && recentOrder ? 'addition_recap' : 'order_recap';
    
    if (matchedItems.length > 0) {
      // Build order recap
      const itemsList = matchedItems.map(item => 
        `• ${item.quantity}x ${item.product_name}`
      ).join('\n');
      
      responseMessage = RESPONSE_TEMPLATES.order_recap[language as keyof typeof RESPONSE_TEMPLATES.order_recap]
        .replace('{items}', itemsList);
      
      // Add note if this is an addition
      if (isAddition && recentOrder) {
        const additionNote = language === 'pap' ? '\n\n📦 Esaki ta un adishon na bo orden existente.' :
                           language === 'nl' ? '\n\n📦 Dit is een toevoeging aan uw bestaande bestelling.' :
                           language === 'es' ? '\n\n📦 Esta es una adición a tu pedido existente.' :
                           '\n\n📦 This is an addition to your existing order.';
        responseMessage += additionNote;
      }
      
      // Add unmatched items warning with varied responses
      if (unmatchedItems.length > 0) {
        const noMatchMsg = unmatchedItems.map(item => 
          getNoMatchResponse(language, item)
        ).join('\n');
        responseMessage += '\n\n' + noMatchMsg;
      }
      
      // Create/update draft session for incomplete orders
      // Get recent messages for conversation snapshot
      const { data: recentMsgs } = await supabase
        .from('whatsapp_messages')
        .select('direction, message_text, created_at')
        .eq('phone_number', customer_phone)
        .order('created_at', { ascending: false })
        .limit(10);
      
      const conversationSnapshot = (recentMsgs || []).reverse().map(m => ({
        direction: m.direction,
        message_text: m.message_text,
        created_at: m.created_at
      }));
      
      // Upsert session (update if exists, create if not)
      const { error: sessionError } = await supabase
        .from('distribution_order_sessions')
        .upsert({
          customer_id: customer_id || null,
          customer_phone: customer_phone,
          customer_name: customer_name || null,
          parsed_items: matchedItems,
          detected_language: language,
          conversation_snapshot: conversationSnapshot,
          status: 'pending_confirmation',
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min from now
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'customer_phone',
          ignoreDuplicates: false
        });
      
      if (sessionError) {
        console.error('Failed to create/update order session:', sessionError);
      } else {
        console.log('Draft order session created/updated for', customer_phone, '- reminder will be sent if not confirmed within 30 min');
      }
      
    } else {
      // No products matched - use varied responses
      responseMessage = unmatchedItems.map(item => 
        getNoMatchResponse(language, item)
      ).join('\n');
    }

    // Send response
    await sendWhatsAppMessage(customer_phone, responseMessage);
    
    // Store outbound message with parsed items for later confirmation
    await supabase.from('whatsapp_messages').insert({
      direction: 'outbound',
      phone_number: customer_phone,
      message_text: responseMessage,
      customer_id: customer_id || null,
      status: 'sent'
    });
    
    // Store conversation with parsed items
    await supabase.from('distribution_conversations').insert({
      customer_id: customer_id || null,
      direction: 'outbound',
      message_text: responseMessage,
      detected_language: language,
      parsed_intent: intentType,
      parsed_items: matchedItems
    });

    return new Response(JSON.stringify({ 
      success: true, 
      action: intentType,
      matched_items: matchedItems.length,
      unmatched_items: unmatchedItems.length,
      is_new_customer: isNewCustomer,
      is_addition: isAddition && !!recentOrder,
      parent_order_id: isAddition ? recentOrder?.id : null,
      customer_id: customer_id || null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('AI Agent error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
