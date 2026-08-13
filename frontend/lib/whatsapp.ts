function toWhatsAppDigits(phone: string) {
  return phone.replace(/\D/g, "");
}

export function buildWhatsAppUrl(phone: string, message?: string) {
  const digits = toWhatsAppDigits(phone);
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${text}`;
}
