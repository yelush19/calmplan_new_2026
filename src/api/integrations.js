// Supabase Storage integrations for file upload/download
import { supabase, isSupabaseConfigured } from './supabaseClient';

const BUCKET_NAME = 'calmplan-files';

const notAvailable = async () => {
  console.warn('Integration not available');
  return { success: false, error: 'Not available' };
};

// The "calmplan-files" bucket must be created manually in Supabase Dashboard
// (Storage → New Bucket → "calmplan-files"), and storage policies must be set
// up via /setup-storage.sql. We do NOT call listBuckets/createBucket here:
// the anon key is filtered by RLS on storage.buckets and listBuckets() returns
// an empty list, which would falsely trigger a doomed createBucket() attempt.
// Instead we let the upload itself surface any real error.
async function ensureBucket() {
  // No-op by design — see comment above.
}

// Translate raw Supabase storage errors into actionable Hebrew messages.
function describeStorageError(error) {
  const msg = (error?.message || '').toLowerCase();
  const status = error?.statusCode || error?.status;

  if (msg.includes('bucket') && (msg.includes('not found') || status === 404)) {
    return `Bucket "${BUCKET_NAME}" לא נמצא. צור אותו ב-Supabase Dashboard → Storage → New Bucket → "${BUCKET_NAME}"`;
  }
  if (
    msg.includes('row-level security') ||
    msg.includes('rls') ||
    msg.includes('policy') ||
    msg.includes('not authorized') ||
    msg.includes('unauthorized') ||
    status === 401 ||
    status === 403
  ) {
    return (
      `אין הרשאת העלאה ל-bucket "${BUCKET_NAME}". ` +
      `הרץ את הסקריפט /setup-storage.sql ב-Supabase Dashboard → SQL Editor כדי להוסיף policies.`
    );
  }
  return `שגיאה בהעלאת קובץ: ${error?.message || 'שגיאה לא ידועה'}`;
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

  if (error) {
    throw new Error(describeStorageError(error));
  }

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

/**
 * Upload a file to a client-specific folder with progress tracking.
 * @param {{ file: File, clientId: string, documentType?: string, onProgress?: (percent: number) => void }} params
 * @returns {{ file_url: string, file_name: string, file_size: number, file_path: string, file_type: string }}
 */
async function uploadClientFile({ file, clientId, documentType = 'other', onProgress }) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase לא מוגדר. בדוק את הגדרות הסביבה.');
  }
  await ensureBucket();

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._\u0590-\u05FF-]/g, '_');
  const folderPath = `clients/${clientId}/${documentType}`;
  const filePath = `${folderPath}/${timestamp}_${safeName}`;

  // Simulate progress for smaller files since Supabase JS SDK doesn't expose upload progress natively
  let progressInterval;
  let simulatedProgress = 0;
  if (onProgress) {
    onProgress(0);
    progressInterval = setInterval(() => {
      simulatedProgress = Math.min(simulatedProgress + Math.random() * 15, 85);
      onProgress(Math.round(simulatedProgress));
    }, 200);
  }

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (progressInterval) clearInterval(progressInterval);
    if (onProgress) onProgress(90);

    if (error) {
      throw new Error(describeStorageError(error));
    }

    // Get a signed URL (valid for 1 year)
    const { data: urlData, error: urlError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(data.path, 365 * 24 * 60 * 60);

    if (urlError) throw new Error(`שגיאה ביצירת קישור: ${urlError.message}`);

    if (onProgress) onProgress(100);

    return {
      file_url: urlData.signedUrl,
      file_name: file.name,
      file_size: file.size,
      file_path: data.path,
      file_type: file.type,
    };
  } catch (err) {
    if (progressInterval) clearInterval(progressInterval);
    throw err;
  }
}

/**
 * Create a temporary sharing link with custom expiry.
 * @param {{ file_path: string, expiresInSeconds?: number }} params
 * @returns {{ file_url: string, expires_at: string }}
 */
async function createSharingLink({ file_path, expiresInSeconds = 7 * 24 * 60 * 60 }) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase לא מוגדר.');
  }
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(file_path, expiresInSeconds);
  if (error) throw new Error(`שגיאה ביצירת קישור שיתוף: ${error.message}`);

  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  return { file_url: data.signedUrl, expires_at: expiresAt };
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
  UploadClientFile: uploadClientFile,
  CreateSharingLink: createSharingLink,
};

export const InvokeLLM = Core.InvokeLLM;
export const SendEmail = Core.SendEmail;
export const UploadFile = Core.UploadFile;
export const GenerateImage = Core.GenerateImage;
export const ExtractDataFromUploadedFile = Core.ExtractDataFromUploadedFile;
export const CreateFileSignedUrl = Core.CreateFileSignedUrl;
export const UploadPrivateFile = Core.UploadPrivateFile;
export const DeleteFile = Core.DeleteFile;
export const UploadClientFile = Core.UploadClientFile;
export const CreateSharingLink = Core.CreateSharingLink;
