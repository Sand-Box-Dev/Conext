import React, { useRef, useState } from 'react';
import { UploadCloud, AlertCircle } from 'lucide-react';

interface DocumentUploadProps {
  onUploadSuccess: (file: File) => Promise<void>;
  isUploading: boolean;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  onUploadSuccess,
  isUploading,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setErrorMsg(null);

    // Validate extension
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.pdf', '.txt', '.md'].includes(ext)) {
      setErrorMsg('Please upload a PDF or TXT educational document.');
      return;
    }

    // Validate size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('File exceeds the 10 MB limit.');
      return;
    }

    try {
      await onUploadSuccess(file);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to upload document');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center text-center ${
          dragOver
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-slate-700/80 hover:border-blue-500/50 bg-slate-900/40 hover:bg-slate-900/80'
        } ${isUploading ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => handleFiles(e.target.files)}
          accept=".pdf,.txt,.md"
          className="hidden"
        />

        <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-2 text-blue-400">
          <UploadCloud className="w-5 h-5" />
        </div>

        <p className="text-xs font-semibold text-slate-200 mb-0.5">
          {isUploading ? 'Extracting text...' : 'Upload PDF or TXT'}
        </p>
        <p className="text-[10px] text-slate-400">
          Max 10MB • Text-based documents
        </p>
      </div>

      {errorMsg && (
        <div className="mt-2.5 p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-start gap-2 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
};
