import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, X, FileText, Image, Table, File } from 'lucide-react';

function getFileExtension(fileName) {
  return fileName?.split('.').pop()?.toLowerCase() || '';
}

function isImage(fileName) {
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(getFileExtension(fileName));
}

function isPDF(fileName) {
  return getFileExtension(fileName) === 'pdf';
}

function isExcel(fileName) {
  return ['xls', 'xlsx', 'csv'].includes(getFileExtension(fileName));
}

function getFileTypeIcon(fileName) {
  if (isImage(fileName)) return Image;
  if (isPDF(fileName)) return FileText;
  if (isExcel(fileName)) return Table;
  return File;
}

function getFileTypeLabel(fileName) {
  const ext = getFileExtension(fileName);
  const labels = {
    pdf: 'PDF',
    doc: 'Word',
    docx: 'Word',
    xls: 'Excel',
    xlsx: 'Excel',
    csv: 'CSV',
    jpg: 'JPEG',
    jpeg: 'JPEG',
    png: 'PNG',
    gif: 'GIF',
    txt: 'Text',
  };
  return labels[ext] || ext.toUpperCase();
}

export default function FilePreview({ file, open, onClose }) {
  const [imageError, setImageError] = useState(false);

  if (!file) return null;

  const fileName = file.file_name || '';
  const fileUrl = file.file_url || '';
  const FileIcon = getFileTypeIcon(fileName);

  const renderPreview = () => {
    if (isImage(fileName) && !imageError) {
      return (
        <div className="flex items-center justify-center bg-gray-100 rounded-lg p-4 min-h-[300px]">
          <img
            src={fileUrl}
            alt={fileName}
            className="max-w-full max-h-[60vh] object-contain rounded"
            onError={() => setImageError(true)}
          />
        </div>
      );
    }

    if (isPDF(fileName)) {
      return (
        <div className="bg-gray-100 rounded-lg overflow-hidden" style={{ height: '60vh' }}>
          <iframe
            src={fileUrl}
            title={fileName}
            className="w-full h-full border-0"
          />
        </div>
      );
    }

    // For Excel and other files - show info card
    return (
      <div className="flex flex-col items-center justify-center bg-gray-50 rounded-lg p-12 min-h-[200px]">
        <FileIcon className="w-16 h-16 text-gray-400 mb-4" />
        <p className="text-lg font-medium text-gray-700 mb-1">{fileName}</p>
        <p className="text-sm text-gray-500 mb-4">
          {getFileTypeLabel(fileName)} | {formatFileSize(file.file_size)}
        </p>
        <p className="text-xs text-gray-400 mb-6">
          תצוגה מקדימה לא זמינה עבור סוג קובץ זה
        </p>
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <a href={fileUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 ml-2" />
              פתח בחלון חדש
            </a>
          </Button>
          <Button asChild>
            <a href={fileUrl} download={fileName}>
              <Download className="w-4 h-4 ml-2" />
              הורד
            </a>
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileIcon className="w-5 h-5" />
            {fileName}
          </DialogTitle>
        </DialogHeader>

        {renderPreview()}

        <div className="flex justify-between items-center pt-2">
          <div className="text-sm text-gray-500">
            {getFileTypeLabel(fileName)}
            {file.file_size && ` | ${formatFileSize(file.file_size)}`}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 ml-2" />
                פתח
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={fileUrl} download={fileName}>
                <Download className="w-4 h-4 ml-2" />
                הורד
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export { getFileTypeIcon, getFileTypeLabel, isImage, isPDF, isExcel, formatFileSize };
