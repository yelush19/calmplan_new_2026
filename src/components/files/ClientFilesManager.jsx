import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FolderOpen, Upload, RefreshCw, FileText, Copy, Check, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { FileMetadata, Client } from '@/api/entities';
import { DeleteFile, CreateSharingLink } from '@/api/integrations';
import FileUploader from './FileUploader';
import FileList from './FileList';
import FilePreview from './FilePreview';
import FileMetadataForm from './FileMetadataForm';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ClientFilesManager({ clientId, clientName }) {
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [editingFile, setEditingFile] = useState(null);
  const [sharingFile, setSharingFile] = useState(null);
  const [sharingLink, setSharingLink] = useState(null);
  const [sharingExpiry, setSharingExpiry] = useState('7d');
  const [isCopied, setIsCopied] = useState(false);

  const loadFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const allFiles = await FileMetadata.filter({ client_id: clientId });
      setFiles(allFiles || []);
    } catch (err) {
      console.error('Error loading files:', err);
      toast.error('שגיאה בטעינת קבצים');
      setFiles([]);
    }
    setIsLoading(false);
  }, [clientId]);

  useEffect(() => {
    if (clientId) loadFiles();
  }, [clientId, loadFiles]);

  // Handle upload completion - create metadata records
  const handleUploadComplete = async (uploadedFiles) => {
    try {
      const user = { full_name: 'ליתאי' }; // Will be replaced when auth is implemented

      for (const uploaded of uploadedFiles) {
        await FileMetadata.create({
          client_id: clientId,
          client_name: clientName,
          file_name: uploaded.file_name,
          file_path: uploaded.file_path,
          file_url: uploaded.file_url,
          file_size: uploaded.file_size,
          file_type: uploaded.file_type || '',
          document_type: 'other',
          year: String(new Date().getFullYear()),
          month: '',
          status: 'final',
          notes: '',
          uploaded_by: user.full_name,
          version: 1,
          parent_file_id: null,
          tags: [],
        });
      }

      toast.success(`${uploadedFiles.length} קבצים הועלו בהצלחה`);
      await loadFiles();
      setShowUploadDialog(false);
    } catch (err) {
      console.error('Error saving file metadata:', err);
      toast.error('שגיאה בשמירת פרטי הקבצים');
    }
  };

  // Handle metadata edit
  const handleSaveMetadata = async (updatedData) => {
    try {
      await FileMetadata.update(editingFile.id, updatedData);
      toast.success('פרטי הקובץ עודכנו');
      setEditingFile(null);
      await loadFiles();
    } catch (err) {
      console.error('Error updating metadata:', err);
      toast.error('שגיאה בעדכון פרטי הקובץ');
    }
  };

  // Handle file delete
  const handleDeleteFile = async (file) => {
    if (!window.confirm(`האם למחוק את "${file.file_name}"?`)) return;

    try {
      // Delete from storage
      if (file.file_path) {
        await DeleteFile({ file_path: file.file_path });
      }
      // Delete metadata
      await FileMetadata.delete(file.id);
      toast.success('הקובץ נמחק');
      await loadFiles();
    } catch (err) {
      console.error('Error deleting file:', err);
      toast.error('שגיאה במחיקת הקובץ');
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async (fileIds) => {
    try {
      const filesToDelete = files.filter(f => fileIds.includes(f.id));

      for (const file of filesToDelete) {
        if (file.file_path) {
          await DeleteFile({ file_path: file.file_path });
        }
        await FileMetadata.delete(file.id);
      }

      toast.success(`${fileIds.length} קבצים נמחקו`);
      await loadFiles();
    } catch (err) {
      console.error('Error bulk deleting:', err);
      toast.error('שגיאה במחיקת קבצים');
    }
  };

  // Handle sharing
  const handleShare = async (file) => {
    setSharingFile(file);
    setSharingLink(null);
    setIsCopied(false);
    setSharingExpiry('7d');
  };

  const generateSharingLink = async () => {
    if (!sharingFile?.file_path) return;

    const expiryMap = {
      '1h': 3600,
      '24h': 86400,
      '7d': 604800,
      '30d': 2592000,
    };

    try {
      const result = await CreateSharingLink({
        file_path: sharingFile.file_path,
        expiresInSeconds: expiryMap[sharingExpiry] || 604800,
      });
      setSharingLink(result);
    } catch (err) {
      console.error('Error creating sharing link:', err);
      toast.error('שגיאה ביצירת קישור שיתוף');
    }
  };

  const copyLink = async () => {
    if (!sharingLink?.file_url) return;
    try {
      await navigator.clipboard.writeText(sharingLink.file_url);
      setIsCopied(true);
      toast.success('הקישור הועתק');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Fallback for non-HTTPS
      const input = document.createElement('input');
      input.value = sharingLink.file_url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setIsCopied(true);
      toast.success('הקישור הועתק');
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const expiryLabels = {
    '1h': 'שעה',
    '24h': '24 שעות',
    '7d': 'שבוע',
    '30d': 'חודש',
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <FolderOpen className="w-6 h-6 text-primary" />
          <div>
            <h3 className="text-lg font-bold">ניהול קבצים - {clientName}</h3>
            <p className="text-sm text-gray-500">{files.length} קבצים</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadFiles} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={() => setShowUploadDialog(true)} className="bg-primary hover:bg-accent">
            <Upload className="w-4 h-4 ml-2" />
            העלה קבצים
          </Button>
        </div>
      </div>

      {/* File List */}
      <FileList
        files={files}
        isLoading={isLoading}
        onPreview={setPreviewFile}
        onEdit={setEditingFile}
        onDelete={handleDeleteFile}
        onShare={handleShare}
        onBulkDelete={handleBulkDelete}
      />

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              העלאת קבצים - {clientName}
            </DialogTitle>
            <DialogDescription>
              גרור קבצים או לחץ לבחירה. הקבצים יישמרו בתיקיית הלקוח.
            </DialogDescription>
          </DialogHeader>
          <FileUploader
            clientId={clientId}
            clientName={clientName}
            onUploadComplete={handleUploadComplete}
            onClose={() => setShowUploadDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* File Preview */}
      <FilePreview
        file={previewFile}
        open={!!previewFile}
        onClose={() => setPreviewFile(null)}
      />

      {/* Edit Metadata Dialog */}
      <Dialog open={!!editingFile} onOpenChange={(open) => { if (!open) setEditingFile(null); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              עריכת פרטי קובץ
            </DialogTitle>
            <DialogDescription>
              {editingFile?.file_name}
            </DialogDescription>
          </DialogHeader>
          {editingFile && (
            <FileMetadataForm
              fileData={editingFile}
              onSave={handleSaveMetadata}
              onCancel={() => setEditingFile(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Sharing Dialog */}
      <Dialog open={!!sharingFile} onOpenChange={(open) => { if (!open) { setSharingFile(null); setSharingLink(null); } }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ExternalLink className="w-5 h-5" />
              שיתוף קובץ
            </DialogTitle>
            <DialogDescription>
              צור קישור זמני לשיתוף "{sharingFile?.file_name}" עם לקוח
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>תוקף הקישור</Label>
              <Select value={sharingExpiry} onValueChange={setSharingExpiry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">שעה אחת</SelectItem>
                  <SelectItem value="24h">24 שעות</SelectItem>
                  <SelectItem value="7d">שבוע</SelectItem>
                  <SelectItem value="30d">חודש</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={generateSharingLink} className="w-full bg-primary hover:bg-accent">
              <ExternalLink className="w-4 h-4 ml-2" />
              צור קישור שיתוף
            </Button>

            {sharingLink && (
              <div className="space-y-3 p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm font-medium text-green-800">הקישור נוצר בהצלחה!</p>
                <div className="flex gap-2">
                  <Input
                    value={sharingLink.file_url}
                    readOnly
                    className="text-xs bg-white"
                    dir="ltr"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyLink}
                    className="flex-shrink-0"
                  >
                    {isCopied ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-green-700">
                  פג תוקף: {new Date(sharingLink.expires_at).toLocaleString('he-IL')}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
