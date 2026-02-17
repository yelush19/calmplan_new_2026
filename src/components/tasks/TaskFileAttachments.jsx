import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UploadFile, DeleteFile } from '@/api/integrations';
import { Task } from '@/api/entities';
import {
  Paperclip, Upload, Loader2, FileText, Image, File,
  Trash2, Download, X
} from 'lucide-react';

const FILE_ICONS = {
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  xls: FileText,
  xlsx: FileText,
  jpg: Image,
  jpeg: Image,
  png: Image,
  gif: Image,
};

function getFileIcon(fileName) {
  const ext = (fileName || '').split('.').pop()?.toLowerCase();
  return FILE_ICONS[ext] || File;
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function TaskFileAttachments({ taskId, attachments = [], onUpdate }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      setError('הקובץ גדול מדי (מקסימום 50MB)');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const result = await UploadFile({ file });
      const newAttachment = {
        id: crypto.randomUUID(),
        file_url: result.file_url,
        file_name: result.file_name,
        file_size: result.file_size,
        file_path: result.file_path,
        uploaded_at: new Date().toISOString(),
      };
      const updated = [...attachments, newAttachment];
      await Task.update(taskId, { attachments: updated });
      onUpdate?.(updated);
    } catch (err) {
      setError(err.message || 'שגיאה בהעלאת הקובץ');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (attachmentId) => {
    if (!window.confirm('למחוק את הקובץ?')) return;
    const attachment = attachments.find(a => a.id === attachmentId);
    try {
      if (attachment?.file_path) {
        await DeleteFile({ file_path: attachment.file_path });
      }
      const updated = attachments.filter(a => a.id !== attachmentId);
      await Task.update(taskId, { attachments: updated });
      onUpdate?.(updated);
    } catch (err) {
      setError(err.message || 'שגיאה במחיקה');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Paperclip className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-xs font-medium text-gray-600">
          קבצים מצורפים {attachments.length > 0 && `(${attachments.length})`}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs gap-1"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          {uploading ? 'מעלה...' : 'העלה'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt,.csv"
          onChange={handleUpload}
        />
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 flex items-center gap-1">
          <X className="w-3 h-3 cursor-pointer" onClick={() => setError(null)} />
          {error}
        </div>
      )}

      {attachments.length > 0 && (
        <div className="space-y-1">
          {attachments.map(att => {
            const IconComp = getFileIcon(att.file_name);
            return (
              <div key={att.id} className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-md text-xs group hover:bg-gray-100 transition-colors">
                <IconComp className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <a
                  href={att.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline truncate flex-1 max-w-[200px]"
                  title={att.file_name}
                >
                  {att.file_name}
                </a>
                {att.file_size && (
                  <span className="text-gray-400 text-[10px]">{formatFileSize(att.file_size)}</span>
                )}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={att.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-0.5 hover:bg-blue-100 rounded"
                    title="הורד"
                  >
                    <Download className="w-3 h-3 text-blue-500" />
                  </a>
                  <button
                    onClick={() => handleDelete(att.id)}
                    className="p-0.5 hover:bg-red-100 rounded"
                    title="מחק"
                  >
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
