function photo(name: string) {
  return `/images/${encodeURIComponent(name)}`;
}

export const photos = {
  street: photo("WhatsApp Image 2026-10-10 at 4.47.51 PM (1).jpeg"),
  sorting: photo("WhatsApp Image 2026-10-10 at 4.47.51 PM.jpeg"),
  plant: photo("WhatsApp Image 2026-10-10 at 4.47.50 PM.jpeg"),
  loading: photo("WhatsApp Image 2026-10-10 at 4.42.43 PM.jpeg"),
  handover: photo("WhatsApp Image 2026-10-10 at 4.39.06 PM.jpeg"),
  organic: photo("WhatsApp Image 2026-10-10 at 4.42.43 PM (1).jpeg"),
};
