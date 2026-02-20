// Local integrations - mock implementations for Base44 integrations

// Core integrations (mock implementations)
export const Core = {
  InvokeLLM: async (params) => {
    console.log('InvokeLLM called (mock):', params);
    return { response: 'זוהי תשובה מקומית - LLM אינו זמין במצב offline' };
  },
  SendEmail: async (params) => {
    console.log('SendEmail called (mock):', params);
    return { success: true, message: 'Email simulation - not actually sent in local mode' };
  },
  UploadFile: async (file) => {
    console.log('UploadFile called (mock):', file?.name);
    // Create a local object URL for the file
    if (file instanceof File) {
      const url = URL.createObjectURL(file);
      return { url, name: file.name };
    }
    return { url: '', name: '' };
  },
  GenerateImage: async (params) => {
    console.log('GenerateImage called (mock):', params);
    return { url: 'https://via.placeholder.com/400x300?text=Generated+Image' };
  },
  ExtractDataFromUploadedFile: async (params) => {
    console.log('ExtractDataFromUploadedFile called (mock):', params);
    return { data: [], message: 'File extraction not available in local mode' };
  }
};

export const InvokeLLM = Core.InvokeLLM;
export const SendEmail = Core.SendEmail;
export const UploadFile = Core.UploadFile;
export const GenerateImage = Core.GenerateImage;
export const ExtractDataFromUploadedFile = Core.ExtractDataFromUploadedFile;
