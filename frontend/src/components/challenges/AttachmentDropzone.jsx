import React, { useState, useRef } from "react";
import {
  UploadCloud,
  File,
  FileText,
  Image as ImageIcon,
  Archive,
  X,
  AlertCircle,
  CheckCircle2,
  Download,
} from "lucide-react";

export const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".doc",
  ".docx",
  ".zip",
];
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getFileIcon(filename = "") {
  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
    return <ImageIcon size={18} className="text-cyan-400 shrink-0" />;
  }
  if ([".doc", ".docx"].includes(ext)) {
    return <FileText size={18} className="text-blue-400 shrink-0" />;
  }
  if ([".zip"].includes(ext)) {
    return <Archive size={18} className="text-amber-400 shrink-0" />;
  }
  return <File size={18} className="text-primary-400 shrink-0" />;
}

export default function AttachmentDropzone({
  stagedFiles = [],
  onFilesChange,
  existingAttachments = [],
  onRemoveExisting,
  disabled = false,
  maxFiles = 5,
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const inputRef = useRef(null);

  const validateAndAddFiles = (incomingFiles) => {
    setErrorMessage("");
    const validBatch = [];
    const currentCount = stagedFiles.length + existingAttachments.length;

    for (const file of incomingFiles) {
      if (currentCount + validBatch.length >= maxFiles) {
        setErrorMessage(`Maximum limit of ${maxFiles} attachments reached.`);
        break;
      }

      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setErrorMessage(
          `Unsupported file type '${ext}'. Allowed types: ${ALLOWED_EXTENSIONS.join(", ")}`
        );
        continue;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setErrorMessage(`File '${file.name}' exceeds the 10 MB size limit.`);
        continue;
      }

      // Check duplicates
      const isDuplicate = stagedFiles.some((f) => f.name === file.name && f.size === file.size);
      if (!isDuplicate) {
        validBatch.push(file);
      }
    }

    if (validBatch.length > 0) {
      onFilesChange?.([...stagedFiles, ...validBatch]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(Array.from(e.target.files));
    }
    // Reset input so same file can be picked again if removed
    e.target.value = "";
  };

  const handleRemoveStaged = (index) => {
    const updated = stagedFiles.filter((_, i) => i !== index);
    onFilesChange?.(updated);
    setErrorMessage("");
  };

  return (
    <div className="space-y-4">
      {/* Drop Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-label="Upload supporting documents and photos"
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer
                    transition-all duration-200 outline-none
                    ${
                      isDragOver
                        ? "border-primary-400 bg-primary-500/10 scale-[1.01]"
                        : "border-white/15 bg-white/5 hover:border-primary-500/40 hover:bg-white/8"
                    }
                    ${disabled ? "opacity-50 cursor-not-allowed" : "focus:ring-2 focus:ring-primary-500"}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED_EXTENSIONS.join(",")}
          onChange={handleFileSelect}
          disabled={disabled}
          className="hidden"
          aria-hidden="true"
        />

        <div className="flex flex-col items-center justify-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-primary-500/20 text-primary-400 flex items-center justify-center mb-1">
            <UploadCloud size={24} />
          </div>
          <p className="text-sm font-semibold text-white">
            Click to upload or drag & drop files here
          </p>
          <p className="text-xs text-white/50 max-w-sm">
            PDF, PNG, JPG, WEBP, DOCX, ZIP (up to 10 MB per file, max {maxFiles} attachments)
          </p>
        </div>
      </div>

      {/* Error alert message */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Pre-existing attachments list (e.g. from server) */}
      {existingAttachments.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-white/70 uppercase tracking-wider">
            Current Attachments ({existingAttachments.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {existingAttachments.map((att, idx) => (
              <div
                key={att.url || idx}
                className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 text-xs"
              >
                <div className="flex items-center gap-2.5 truncate mr-2">
                  {getFileIcon(att.name)}
                  <div className="truncate">
                    <p className="text-white font-medium truncate">{att.name}</p>
                    {att.sizeBytes && (
                      <p className="text-[11px] text-white/40">{formatFileSize(att.sizeBytes)}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {att.url && (
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-white/60 hover:text-white rounded-lg hover:bg-white/10 transition"
                      title="Download / View"
                      aria-label="Download attachment"
                    >
                      <Download size={14} />
                    </a>
                  )}
                  {onRemoveExisting && (
                    <button
                      type="button"
                      onClick={() => onRemoveExisting(idx)}
                      disabled={disabled}
                      className="p-1.5 text-rose-400/70 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition"
                      title="Remove attachment"
                      aria-label="Remove attachment"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staged new files waiting to be uploaded */}
      {stagedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-accent-300 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 size={13} /> Files Selected For Upload ({stagedFiles.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {stagedFiles.map((file, idx) => (
              <div
                key={`${file.name}-${file.size}-${idx}`}
                className="flex items-center justify-between p-3 rounded-xl bg-accent-500/10 border border-accent-500/20 text-xs"
              >
                <div className="flex items-center gap-2.5 truncate mr-2">
                  {getFileIcon(file.name)}
                  <div className="truncate">
                    <p className="text-white font-medium truncate">{file.name}</p>
                    <p className="text-[11px] text-accent-300/80">{formatFileSize(file.size)}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveStaged(idx)}
                  disabled={disabled}
                  className="p-1.5 text-white/50 hover:text-rose-400 rounded-lg hover:bg-white/10 transition shrink-0"
                  title="Remove staged file"
                  aria-label="Remove staged file"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
