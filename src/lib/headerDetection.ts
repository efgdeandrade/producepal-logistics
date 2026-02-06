/**
 * Detect customer names and dates from header lines like "Nut house 2 Feb", "Quiznos 2feb", "Porter 2feb"
 */

interface HeaderDetectionResult {
  detectedCustomerId: string | null;
  detectedCustomerName: string | null;
  detectedDeliveryDate: string | null;
  headerLines: string[];
}

interface Customer {
  id: string;
  name: string;
}

// Month patterns in multiple languages
const monthPatterns: Record<string, number> = {
  // English
  'jan': 0, 'january': 0,
  'feb': 1, 'february': 1,
  'mar': 2, 'march': 2,
  'apr': 3, 'april': 3,
  'may': 4,
  'jun': 5, 'june': 5,
  'jul': 6, 'july': 6,
  'aug': 7, 'august': 7,
  'sep': 8, 'sept': 8, 'september': 8,
  'oct': 9, 'october': 9,
  'nov': 10, 'november': 10,
  'dec': 11, 'december': 11,
  // Dutch
  'januari': 0,
  'februari': 1,
  'maart': 2,
  'mei': 4,
  'juni': 5,
  'juli': 6,
  'augustus': 7,
  'oktober': 9,
  // Spanish
  'enero': 0,
  'febrero': 1,
  'marzo': 2,
  'abril': 3,
  'mayo': 4,
  'junio': 5,
  'julio': 6,
  'agosto': 7,
  'septiembre': 8,
  'octubre': 9,
  'noviembre': 10,
  'diciembre': 11,
};

/**
 * Extract date from text like "2 Feb", "2feb", "feb 2", "02-02", etc.
 */
function extractDateFromText(text: string): string | null {
  const textLower = text.toLowerCase().trim();
  const now = new Date();
  const currentYear = now.getFullYear();
  
  // Pattern 1: "2 Feb", "2feb", "02 february"
  const dayMonthPattern = /(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i;
  const match1 = textLower.match(dayMonthPattern);
  if (match1) {
    const day = parseInt(match1[1]);
    const monthKey = match1[2].toLowerCase();
    const month = monthPatterns[monthKey];
    if (month !== undefined && day >= 1 && day <= 31) {
      const date = new Date(currentYear, month, day);
      // If date is in the past, assume next year
      if (date < now) {
        date.setFullYear(currentYear + 1);
      }
      return date.toISOString().split('T')[0];
    }
  }
  
  // Pattern 2: "Feb 2", "february 02"
  const monthDayPattern = /(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s*(\d{1,2})/i;
  const match2 = textLower.match(monthDayPattern);
  if (match2) {
    const monthKey = match2[1].toLowerCase();
    const day = parseInt(match2[2]);
    const month = monthPatterns[monthKey];
    if (month !== undefined && day >= 1 && day <= 31) {
      const date = new Date(currentYear, month, day);
      if (date < now) {
        date.setFullYear(currentYear + 1);
      }
      return date.toISOString().split('T')[0];
    }
  }
  
  // Pattern 3: "02-02", "2/2" (day/month format common in Europe)
  const numericPattern = /(\d{1,2})[-\/](\d{1,2})/;
  const match3 = textLower.match(numericPattern);
  if (match3) {
    const day = parseInt(match3[1]);
    const month = parseInt(match3[2]) - 1; // 0-indexed
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const date = new Date(currentYear, month, day);
      if (date < now) {
        date.setFullYear(currentYear + 1);
      }
      return date.toISOString().split('T')[0];
    }
  }
  
  return null;
}

/**
 * Remove date portion from text to extract customer name
 */
function removeDateFromText(text: string): string {
  // Remove various date patterns
  let cleaned = text
    .replace(/\d{1,2}\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/gi, '')
    .replace(/(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s*\d{1,2}/gi, '')
    .replace(/\d{1,2}[-\/]\d{1,2}([-\/]\d{2,4})?/g, '')
    .trim();
  
  // Remove trailing/leading punctuation and whitespace
  cleaned = cleaned.replace(/^[-:,.\s]+|[-:,.\s]+$/g, '').trim();
  
  return cleaned;
}

/**
 * Calculate similarity between two strings (case-insensitive)
 */
function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  
  // Check if one contains a significant word from the other
  const words1 = s1.split(/\s+/).filter(w => w.length >= 3);
  const words2 = s2.split(/\s+/).filter(w => w.length >= 3);
  
  for (const word of words1) {
    if (s2.includes(word)) return 0.8;
  }
  for (const word of words2) {
    if (s1.includes(word)) return 0.8;
  }
  
  // Simple Levenshtein-based similarity for short strings
  if (s1.length < 20 && s2.length < 20) {
    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 1;
    
    const matrix: number[][] = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(0));
    for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= s2.length; j++) {
      for (let i = 1; i <= s1.length; i++) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    const distance = matrix[s2.length][s1.length];
    return (maxLen - distance) / maxLen;
  }
  
  return 0;
}

/**
 * Detect customer and date from header lines in pasted text
 */
export function detectHeaderInfo(
  text: string,
  customers: Customer[]
): HeaderDetectionResult {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const result: HeaderDetectionResult = {
    detectedCustomerId: null,
    detectedCustomerName: null,
    detectedDeliveryDate: null,
    headerLines: [],
  };
  
  // Only check first 5 lines for headers
  const headerCandidates = lines.slice(0, 5);
  
  for (const line of headerCandidates) {
    // Skip if line looks like a product order (has number + product pattern)
    if (/^\d+\s*(kg|lb|pcs|tros|kashi|kaha|saku|stuk|bunch|case)?\s+[a-z]/i.test(line)) {
      continue;
    }
    
    // Check if line contains a date
    const extractedDate = extractDateFromText(line);
    
    if (extractedDate) {
      result.detectedDeliveryDate = extractedDate;
      result.headerLines.push(line);
      
      // Try to extract customer name from the same line
      const potentialName = removeDateFromText(line);
      
      if (potentialName && potentialName.length >= 2) {
        // Find matching customer
        let bestMatch: { customer: Customer; score: number } | null = null;
        
        for (const customer of customers) {
          const similarity = stringSimilarity(potentialName, customer.name);
          if (similarity > 0.6 && (!bestMatch || similarity > bestMatch.score)) {
            bestMatch = { customer, score: similarity };
          }
        }
        
        if (bestMatch) {
          result.detectedCustomerId = bestMatch.customer.id;
          result.detectedCustomerName = bestMatch.customer.name;
        }
      }
    } else {
      // Line doesn't have a date, check if it's just a customer name
      // Only consider lines that are short (likely just a name, not an order)
      if (line.length <= 40 && !/\d+\s*[a-z]/i.test(line)) {
        let bestMatch: { customer: Customer; score: number } | null = null;
        
        for (const customer of customers) {
          const similarity = stringSimilarity(line, customer.name);
          if (similarity > 0.6 && (!bestMatch || similarity > bestMatch.score)) {
            bestMatch = { customer, score: similarity };
          }
        }
        
        if (bestMatch && !result.detectedCustomerId) {
          result.detectedCustomerId = bestMatch.customer.id;
          result.detectedCustomerName = bestMatch.customer.name;
          result.headerLines.push(line);
        }
      }
    }
  }
  
  return result;
}

/**
 * Check if a line is likely a header (customer name + date) rather than a product
 */
export function isHeaderLine(line: string, customers: Customer[]): boolean {
  const trimmed = line.trim();
  
  // Skip empty lines
  if (!trimmed) return false;
  
  // If it looks like a product order, it's not a header
  if (/^\d+\s*(kg|lb|pcs|tros|kashi|kaha|saku|stuk|bunch|case|x)?\s+[a-z]/i.test(trimmed)) {
    return false;
  }
  
  // Check if it has a date pattern
  const hasDate = extractDateFromText(trimmed) !== null;
  
  // Check if it matches a customer name
  const potentialName = hasDate ? removeDateFromText(trimmed) : trimmed;
  const matchesCustomer = customers.some(c => stringSimilarity(potentialName, c.name) > 0.6);
  
  // It's a header if it has a date and/or matches a customer name
  return (hasDate && potentialName.length >= 2) || (matchesCustomer && trimmed.length <= 40);
}
