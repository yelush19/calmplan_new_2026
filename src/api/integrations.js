// Supabase Storage integrations for file upload/download
import { supabase, isSupabaseConfigured } from './supabaseClient';

const BUCKET_NAME = 'calmplan-files';

const notAvailable = async () => {
  console.warn('Integration not available');
  return { success: false, error: 'Not available' };
};

// Ensure the storage bucket exists (called once on first upload)
let bucketChecked = false;
async function ensureBucket() {
  if (bucketChecked || !isSupabaseConfigured) return;
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some(b => b.name === BUCKET_NAME);
    if (!exists) {
      await supabase.storage.createBucket(BUCKET_NAME, {
        public: false,
        fileSizeLimit: 52428800, // 50MB
      });
    }
    bucketChecked = true;
  } catch (err) {
    console.warn('Bucket check failed (may need manual creation):', err.message);
    bucketChecked = true; // Don't retry on every upload
  }
}

/**
 * Upload a file to Supabase Storage.
 * @param {{ file: File }} params - The file to upload
 * @returns {{ file_url: string, file_name: string, file_size: number }}
 */
async function uploadFile({ file }) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase לא מוגדר. בדוק את הגדרות הסביבה.');
  }
  await ensureBucket();

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._\u0590-\u05FF-]/g, '_');
  const filePath = `uploads/${timestamp}_${safeName}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw new Error(`שגיאה בהעלאת קובץ: ${error.message}`);

  // Get a signed URL (valid for 1 year)
  const { data: urlData, error: urlError } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(data.path, 365 * 24 * 60 * 60);

  if (urlError) throw new Error(`שגיאה ביצירת קישור: ${urlError.message}`);

  return {
    file_url: urlData.signedUrl,
    file_name: file.name,
    file_size: file.size,
    file_path: data.path,
  };
}

/**
 * Create a fresh signed URL for an existing file.
 * @param {{ file_path: string }} params
 * @returns {{ file_url: string }}
 */
async function createFileSignedUrl({ file_path }) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase לא מוגדר.');
  }
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(file_path, 365 * 24 * 60 * 60);
  if (error) throw new Error(`שגיאה ביצירת קישור: ${error.message}`);
  return { file_url: data.signedUrl };
}

/**
 * Delete a file from Supabase Storage.
 * @param {{ file_path: string }} params
 */
async function deleteFile({ file_path }) {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.storage.from(BUCKET_NAME).remove([file_path]);
}

export const Core = {
  InvokeLLM: notAvailable,
  SendEmail: notAvailable,
  UploadFile: uploadFile,
  GenerateImage: notAvailable,
  ExtractDataFromUploadedFile: notAvailable,
  CreateFileSignedUrl: createFileSignedUrl,
  UploadPrivateFile: uploadFile,
  DeleteFile: deleteFile,
};

export const InvokeLLM = Core.InvokeLLM;
export const SendEmail = Core.SendEmail;
export const UploadFile = Core.UploadFile;
export const GenerateImage = Core.GenerateImage;
export const ExtractDataFromUploadedFile = Core.ExtractDataFromUploadedFile;
export const CreateFileSignedUrl = Core.CreateFileSignedUrl;
export const UploadPrivateFile = Core.UploadPrivateFile;
export const DeleteFile = Core.DeleteFile;
