import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, X, FileText, Image, File, CheckCircle, AlertCircle } from 'lucide-react';
import { UploadClientFile } from '@/api/integrations';

const ACCEPTED_TYPES = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.jpg', '.jpeg', '.png', '.gif',
  '.txt', '.csv'
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function getFileIcon(fileName) {
  const ext = fileName?.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return Image;
  if (['pdf', 'doc', 'docx'].includes(ext)) return FileText;
  return File;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function FileUploader({ clientId, clientName, documentType = 'other', onUploadComplete, onClose }) {
  const [files, setFiles] = useState([]);
  const [uploadStates, setUploadStates] = useState({});
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const addFiles = (newFiles) => {
    const validFiles = newFiles.filter(file => {
      if (file.size > MAX_FILE_SIZE) {
        alert(`הקובץ "${file.name}" חורג מגודל מקסימלי (50MB)`);
        return false;
      }
      return true;
    });

    const fileEntries = validFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
    }));

    setFiles(prev => [...prev, ...fileEntries]);
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    addFiles(selectedFiles);
    e.target.value = '';
  };

  const removeFile = (fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    setUploadStates(prev => {
      const next = { ...prev };
      delete next[fileId];
      return next;
    });
  };

  const uploadAllFiles = async () => {
    if (files.length === 0) return;
    setIsUploading(true);

    const results = [];

    for (const fileEntry of files) {
      if (uploadStates[fileEntry.id]?.status === 'done') continue;

      setUploadStates(prev => ({
        ...prev,
        [fileEntry.id]: { status: 'uploading', progress: 0 },
      }));

      try {
        const result = await UploadClientFile({
          file: fileEntry.file,
          clientId,
          documentType,
          onProgress: (percent) => {
            setUploadStates(prev => ({
              ...prev,
              [fileEntry.id]: { status: 'uploading', progress: percent },
            }));
          },
        });

        setUploadStates(prev => ({
          ...prev,
          [fileEntry.id]: { status: 'done', progress: 100 },
        }));

        results.push({
          ...result,
          localId: fileEntry.id,
        });
      } catch (err) {
        setUploadStates(prev => ({
          ...prev,
          [fileEntry.id]: { status: 'error', progress: 0, error: err.message },
        }));
      }
    }

    setIsUploading(false);

    if (results.length > 0 && onUploadComplete) {
      onUploadComplete(results);
    }
  };

  const allDone = files.length > 0 && files.every(f => uploadStates[f.id]?.status === 'done');
  const hasErrors = files.some(f => uploadStates[f.id]?.status === 'error');

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-all duration-200
          ${isDragOver
            ? 'border-primary bg-primary/5 scale-[1.02]'
            : 'border-gray-300 hover:border-primary/50 hover:bg-gray-50'
          }
        `}
      >
        <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragOver ? 'text-primary' : 'text-gray-400'}`} />
        <p className="text-sm font-medium text-gray-700">
          גרור קבצים לכאן או לחץ לבחירה
        </p>
        <p className="text-xs text-gray-500 mt-1">
          PDF, Word, Excel, תמונות, CSV | עד 50MB
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES.join(',')}
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map(fileEntry => {
            const FileIcon = getFileIcon(fileEntry.name);
            const state = uploadStates[fileEntry.id];

            return (
              <Card key={fileEntry.id} className="bg-gray-50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <FileIcon className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{fileEntry.name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(fileEntry.size)}</p>
                      {state?.status === 'uploading' && (
                        <Progress value={state.progress} className="h-1.5 mt-1" />
                      )}
                      {state?.status === 'error' && (
                        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {state.error}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {state?.status === 'done' && (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      )}
                      {state?.status === 'uploading' && (
                        <span className="text-xs text-gray-500">{state.progress}%</span>
                      )}
                      {(!state || state.status === 'error') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => { e.stopPropagation(); removeFile(fileEntry.id); }}
                        >
                          <X className="w-4 h-4 text-gray-400" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Actions */}
      {files.length > 0 && (
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">
            {files.length} קבצים נבחרו
          </span>
          <div className="flex gap-2">
            {onClose && (
              <Button variant="outline" onClick={onClose} disabled={isUploading}>
                ביטול
              </Button>
            )}
            {allDone ? (
              <Button onClick={onClose} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="w-4 h-4 ml-2" />
                סיום
              </Button>
            ) : (
              <Button
                onClick={uploadAllFiles}
                disabled={isUploading || files.length === 0}
                className="bg-primary hover:bg-accent"
              >
                {isUploading ? (
                  <>
                    <Upload className="w-4 h-4 ml-2 animate-bounce" />
                    מעלה...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 ml-2" />
                    העלה {files.length} קבצים
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
