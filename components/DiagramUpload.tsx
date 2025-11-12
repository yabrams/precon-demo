'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

interface UploadedFile {
  url: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

interface DiagramUploadProps {
  onUploadSuccess: (file: UploadedFile) => void;
  onExtractStart: (url: string) => void;
  autoExtract?: boolean; // Auto-trigger extraction after upload
}

export default function DiagramUpload({
  onUploadSuccess,
  onExtractStart,
  autoExtract = true
}: DiagramUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setUploading(true);

    try {
      // Upload to Vercel Blob Storage or local filesystem
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const uploadedData = await uploadResponse.json();
      setUploadedFile(uploadedData);
      onUploadSuccess(uploadedData);

      // Auto-trigger extraction if enabled
      if (autoExtract) {
        onExtractStart(uploadedData.url);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload file');
    } finally {
      setUploading(false);
    }
  }, [onUploadSuccess, onExtractStart, autoExtract]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
  });

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors w-full max-w-2xl
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} disabled={uploading} />

        {uploading ? (
          <div className="space-y-2">
            <div className="text-gray-600">Uploading...</div>
            <div className="w-full bg-gray-200 rounded-full h-2 max-w-xs mx-auto">
              <div className="bg-blue-500 h-2 rounded-full animate-pulse w-3/4"></div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="text-gray-600">
              {isDragActive ? (
                <p>Drop the diagram here...</p>
              ) : (
                <>
                  <p className="font-medium">Click to upload or drag and drop</p>
                  <p className="text-sm text-gray-500 mt-1">
                    PDF, PNG, JPG, GIF up to 10MB
                  </p>
                  {autoExtract && (
                    <p className="text-xs text-blue-600 mt-2">
                      AI extraction will start automatically
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
