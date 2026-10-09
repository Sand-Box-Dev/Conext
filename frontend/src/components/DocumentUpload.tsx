import React, { useRef, useState } from 'react';
import { UploadCloud, AlertCircle } from 'lucide-react';

interface DocumentUploadProps {
  onUploadSuccess: (file: File) => Promise<void>;
  isUploading: boolean;
  randomizePrompt?: boolean;
}

const studyPrompts = [
  'Want to study smarter? Drop a file here.',
  'Ready for a better review session? Drop it here.',
  'Turn your notes into a study space. Add them here.',
  'Let’s make this chapter easier to learn. Drop it here.',
  'Your next study session starts with a file. Drop it here.',
];

const chooseStudyPrompt = () => {
  const previous = localStorage.getItem('conext.last-upload-prompt');
  const options = studyPrompts.filter((prompt) => prompt !== previous);
  const prompt = options[Math.floor(Math.random() * options.length)] ?? studyPrompts[0];
  localStorage.setItem('conext.last-upload-prompt', prompt);
  return prompt;
};

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  onUploadSuccess,
  isUploading,
  randomizePrompt = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [studyPrompt] = useState(() => randomizePrompt ? chooseStudyPrompt() : 'Drop a file or browse');

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setErrorMsg(null);

    // Validate extension
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.pdf', '.txt', '.md'].includes(ext)) {
      setErrorMsg('Please upload a PDF, TXT, or Markdown document.');
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
        role="button"
        tabIndex={isUploading ? -1 : 0}
        aria-label="Upload a PDF or text document, or drop a file here"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && !isUploading) {
            event.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={`upload-dropzone border-2 border-dashed rounded-xl p-4 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center text-center ${dragOver ? 'is-drag-over' : ''} ${
          dragOver
            ? 'border-slate-500 bg-slate-500/10'
            : 'border-slate-700/80 hover:border-slate-500/50 bg-slate-900/40 hover:bg-slate-900/80'
        } ${isUploading ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => handleFiles(e.target.files)}
          accept=".pdf,.txt,.md"
          className="hidden"
        />

        <div className={`upload-drop-icon w-9 h-9 rounded-lg bg-slate-500/10 border border-slate-500/20 flex items-center justify-center mb-2 text-slate-500 ${dragOver ? 'upload-drop-icon-active' : ''}`}>
          <UploadCloud className="w-5 h-5" />
        </div>

        <p className="text-xs font-semibold text-slate-200 mb-0.5">
          {isUploading ? 'Adding your file…' : dragOver ? 'Ooh, a file! Drop it here.' : studyPrompt}
        </p>
        <p className="text-[10px] text-slate-400">
          PDF, TXT, or Markdown · Up to 10 MB
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
