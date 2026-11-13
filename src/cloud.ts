import { createClient } from '@supabase/supabase-js';
import type { SiteContent } from './types';

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
type MediaKind = 'image' | 'video' | 'audio';
type MediaRow = {
  id: string;
  name: string;
  type: MediaKind;
  caption: string;
  date: string;
  description: string;
  storage_path: string;
  created_at: string;
};

type Database = {
  public: {
    Tables: {
      anniversary_content: {
        Row: { id: string; content: Json; updated_at: string };
        Insert: { id?: string; content: Json; updated_at?: string };
        Update: { id?: string; content?: Json; updated_at?: string };
        Relationships: [];
      };
      anniversary_media: {
        Row: MediaRow;
        Insert: Omit<MediaRow, 'created_at'> & { created_at?: string };
        Update: Partial<Omit<MediaRow, 'id' | 'created_at'>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const projectUrl = import.meta.env.VITE_SUPABASE_URL;
const publicKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = projectUrl && publicKey ? createClient<Database>(projectUrl, publicKey) : null;

export async function loadRemoteContent(): Promise<SiteContent | null> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.from('anniversary_content').select('content').eq('id', 'main').maybeSingle();
  if (error) throw error;
  return data ? JSON.parse(JSON.stringify(data.content)) as SiteContent : null;
}

export async function saveRemoteContent(content: SiteContent): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const serialized = JSON.parse(JSON.stringify(content)) as Json;
  const { error } = await supabase.from('anniversary_content').upsert({ id: 'main', content: serialized });
  if (error) throw error;
}

export async function loadRemoteMedia(): Promise<MediaRow[]> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.from('anniversary_media').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export function getRemoteMediaUrl(storagePath: string): string {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase.storage.from('anniversary-media').getPublicUrl(storagePath).data.publicUrl;
}

export async function uploadRemoteMedia(file: File, type: MediaKind): Promise<MediaRow> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const id = crypto.randomUUID();
  const safeName = file.name.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'memory';
  const storagePath = `${type}/${id}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from('anniversary-media').upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase.from('anniversary_media').insert({
    id,
    name: file.name,
    type,
    caption: type === 'audio' ? file.name.replace(/\.[^.]+$/, '') : '',
    date: '',
    description: '',
    storage_path: storagePath,
  }).select('*').single();
  if (error) {
    const { error: cleanupError } = await supabase.storage.from('anniversary-media').remove([storagePath]);
    if (cleanupError) throw new Error(`${error.message} Also, uploaded file cleanup failed: ${cleanupError.message}`);
    throw error;
  }
  return data;
}

export async function updateRemoteMedia(id: string, patch: Pick<MediaRow, 'caption' | 'date' | 'description'>): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('anniversary_media').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteRemoteMedia(item: MediaRow): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error: storageError } = await supabase.storage.from('anniversary-media').remove([item.storage_path]);
  if (storageError) throw storageError;
  const { error } = await supabase.from('anniversary_media').delete().eq('id', item.id);
  if (error) throw error;
}

export type { MediaRow };
