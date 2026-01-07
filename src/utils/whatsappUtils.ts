/**
 * WhatsApp utility functions for mobile workflow
 */

/**
 * Opens WhatsApp with a pre-composed message
 * Uses whatsapp:// deep link for mobile apps
 */
export function openWhatsApp(phone: string, message: string) {
  // Clean phone number - remove all non-digits
  const cleanPhone = phone.replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  
  // Use whatsapp:// protocol for mobile app
  window.location.href = `whatsapp://send?phone=${cleanPhone}&text=${encodedMessage}`;
}

/**
 * Opens WhatsApp without a specific phone number (general open)
 */
export function openWhatsAppGeneral() {
  window.location.href = 'whatsapp://';
}

/**
 * Generate order confirmation message
 */
export function generateOrderConfirmation(
  orderNumber: string,
  customerName: string,
  deliveryDate: string,
  itemCount: number,
  total?: number
): string {
  const lines = [
    '✅ Order Received!',
    '',
    `📦 Order: ${orderNumber}`,
    `👤 Customer: ${customerName}`,
    `📅 Delivery: ${deliveryDate}`,
    `📝 Items: ${itemCount}`,
  ];
  
  if (total !== undefined) {
    lines.push(`💰 Total: ${total.toFixed(2)} XCG`);
  }
  
  lines.push('', 'Thank you for your order! 🙏');
  
  return lines.join('\n');
}

/**
 * Trigger haptic feedback on supported devices
 */
export function vibrate(pattern: number | number[] = 50) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

/**
 * Strong vibration for success actions
 */
export function vibrateSuccess() {
  vibrate([50, 50, 50]);
}

/**
 * Light tap for selection
 */
export function vibrateTap() {
  vibrate(30);
}
