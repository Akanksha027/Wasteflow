import { EncodingType, readAsStringAsync } from 'expo-file-system/legacy';
import { supabase } from '../lib/supabase';

const BUCKET = 'collection-photos';

export async function uploadCollectionPhoto(uri: string, eventId: string): Promise<string | null> {
  const path = `${eventId}.jpg`;

  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    if (!error) {
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return data.publicUrl;
    }
  } catch {
    // Fall through to data-URL backup when storage is unavailable.
  }

  try {
    const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
    if (base64.length > 180_000) return `data:image/jpeg;base64,${base64.slice(0, 180_000)}`;
    return `data:image/jpeg;base64,${base64}`;
  } catch (e) {
    console.warn('uploadCollectionPhoto failed:', e);
    return null;
  }
}
