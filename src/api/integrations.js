// Standalone integrations stubs - no Base44 dependency

const notAvailable = async () => {
  console.warn('Integration not available in standalone mode');
  return { success: false, error: 'Not available' };
};

export const Core = {
  InvokeLLM: notAvailable,
  SendEmail: notAvailable,
  UploadFile: notAvailable,
  GenerateImage: notAvailable,
  ExtractDataFromUploadedFile: notAvailable,
  CreateFileSignedUrl: notAvailable,
  UploadPrivateFile: notAvailable,
};

export const InvokeLLM = Core.InvokeLLM;
export const SendEmail = Core.SendEmail;
export const UploadFile = Core.UploadFile;
export const GenerateImage = Core.GenerateImage;
export const ExtractDataFromUploadedFile = Core.ExtractDataFromUploadedFile;
export const CreateFileSignedUrl = Core.CreateFileSignedUrl;
export const UploadPrivateFile = Core.UploadPrivateFile;
