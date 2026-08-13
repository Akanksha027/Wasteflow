import { EncodingType, readAsStringAsync } from 'expo-file-system/legacy';
import { supabase } from '../lib/supabase';

const BUCKET = 'collection-photos';

function base64ToBytes(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function uploadCollectionPhoto(uri: string, eventId: string): Promise<string | null> {
  const path = `${eventId}.jpg`;

  try {
    const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
    const bytes = base64ToBytes(base64);
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.warn('uploadCollectionPhoto failed:', e);
    return null;
  }
}
