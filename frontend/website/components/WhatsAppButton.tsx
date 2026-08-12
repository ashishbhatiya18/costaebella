function toWhatsAppDigits(phone: string) {
  return phone.replace(/\D/g, "");
}

export function buildWhatsAppUrl(phone: string, message?: string) {
  const digits = toWhatsAppDigits(phone);
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${text}`;
}

export default function WhatsAppButton({
  phone,
  businessName,
}: {
  phone: string;
  businessName: string;
}) {
  const url = buildWhatsAppUrl(phone, `Hi ${businessName}! I'd like to know more.`);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      data-gtm-event="whatsapp_click"
      data-gtm-location="floating_button"
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] shadow-lg hover:scale-105 transition-transform"
    >
      <svg
        viewBox="0 0 32 32"
        width="30"
        height="30"
        fill="white"
        aria-hidden="true"
      >
        <path d="M16.004 3C9.377 3 4 8.377 4 15.004c0 2.373.63 4.6 1.83 6.567L4 29l7.62-1.77a11.94 11.94 0 0 0 4.384.827h.004C22.635 28.057 28 22.68 28 15.996 28 8.377 22.63 3 16.004 3zm0 21.83a9.79 9.79 0 0 1-4.986-1.363l-.358-.213-4.523 1.05 1.076-4.408-.234-.372a9.8 9.8 0 0 1-1.502-5.52c0-5.42 4.41-9.83 9.83-9.83 5.42 0 9.828 4.41 9.828 9.83 0 5.42-4.408 9.826-9.828 9.826h-.303zm5.386-7.36c-.295-.147-1.744-.86-2.015-.958-.27-.098-.467-.147-.664.148-.196.294-.762.957-.934 1.153-.172.196-.344.221-.639.074-.295-.147-1.245-.459-2.372-1.464-.877-.782-1.47-1.748-1.642-2.043-.172-.294-.018-.454.13-.6.133-.133.295-.344.442-.516.148-.172.196-.294.295-.49.098-.196.049-.368-.025-.516-.074-.147-.664-1.6-.91-2.192-.24-.577-.484-.499-.664-.508l-.566-.01c-.196 0-.516.074-.786.368-.27.294-1.03 1.006-1.03 2.455s1.055 2.847 1.202 3.043c.147.196 2.077 3.169 5.033 4.443.703.303 1.252.484 1.68.62.706.224 1.348.192 1.856.117.566-.084 1.744-.712 1.99-1.4.246-.687.246-1.276.172-1.4-.073-.123-.27-.196-.565-.343z" />
      </svg>
    </a>
  );
}
