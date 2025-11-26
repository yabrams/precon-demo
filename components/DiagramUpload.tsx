'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';

interface UploadedFile {
  url: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

interface DiagramUploadProps {
  onUploadSuccess: (file: UploadedFile) => void;
  onExtractStart: (url: string, instructions?: string, useMockData?: boolean) => void;
  bcProjectId: string;
  onCancel: () => void;
}

export default function DiagramUpload({
  onUploadSuccess,
  onExtractStart,
  bcProjectId,
  onCancel,
}: DiagramUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [instructions, setInstructions] = useState('');
  const [useMockData, setUseMockData] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bcProjectId', bcProjectId);

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
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload file');
    } finally {
      setUploading(false);
    }
  }, [onUploadSuccess]);

  const handleExtract = () => {
    if (uploadedFile) {
      onExtractStart(uploadedFile.url, instructions, useMockData);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    disabled: !!uploadedFile || uploading,
  });

  // Show preview and instructions after upload
  if (uploadedFile) {
    return (
      <div className="w-full h-full flex">
        {/* Left side - Diagram Preview */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex-1 bg-gray-50 flex items-center justify-center p-6 overflow-auto"
        >
          <div className="w-full h-full flex items-center justify-center">
            <img
              src={uploadedFile.url}
              alt="Uploaded diagram"
              className="max-w-full max-h-full object-contain shadow-lg rounded"
            />
          </div>
        </motion.div>

        {/* Right side - Instructions */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="flex-1 flex flex-col bg-white p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-zinc-900">
              Instructions for AI (Optional)
            </h3>

            {/* Mock Data Toggle */}
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={useMockData}
                onChange={(e) => setUseMockData(e.target.checked)}
                className="w-4 h-4 text-zinc-900 bg-gray-100 border-gray-300 rounded focus:ring-zinc-500 focus:ring-2 cursor-pointer"
              />
              <span className="text-sm font-medium text-gray-700 group-hover:text-zinc-900 transition-colors">
                Use Mock Data
              </span>
            </label>
          </div>

          {useMockData && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="text-sm text-amber-800">
                  <strong className="font-semibold">Mock Mode Enabled:</strong>
                  <p className="mt-1">
                    The diagram will be uploaded but AI analysis will be skipped.
                    Instead, 5-8 CSI-based bid packages with realistic mock data will be generated.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-xl shadow-sm p-6 hover:border-zinc-300 hover:shadow-md transition-all">
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Add specific instructions for the AI extractor...&#10;&#10;Examples:&#10;- Focus on electrical items only&#10;- Include labor costs&#10;- Group items by room&#10;- Extract quantities from the legend"
              className="flex-1 w-full p-4 bg-white border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500 focus:outline-none text-zinc-900 placeholder:text-gray-400"
              disabled={useMockData}
            />
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => {
                  setUploadedFile(null);
                  setInstructions('');
                  setUseMockData(false);
                  onCancel();
                }}
                className="px-6 py-3 bg-white hover:bg-gray-50 text-zinc-900 border border-gray-200 rounded-lg transition-colors font-medium shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleExtract}
                className="flex-1 px-6 py-3 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-all font-medium shadow-md shadow-zinc-900/10"
              >
                {useMockData ? 'Generate Mock Data →' : 'Process Diagram →'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Show upload dropzone
  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-50">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all w-full max-w-2xl bg-white border-gray-300
          ${isDragActive ? 'border-zinc-500 bg-zinc-50' : 'hover:border-zinc-400 hover:shadow-md'}
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />

        {uploading ? (
          <div className="space-y-4">
            <div className="text-gray-600">Uploading...</div>
            <div className="w-full bg-gray-200 rounded-full h-2 max-w-xs mx-auto overflow-hidden">
              <div className="bg-zinc-900 h-2 rounded-full animate-pulse w-3/4"></div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <svg
              className="mx-auto h-12 w-12 text-gray-500"
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
                <p className="text-zinc-900 font-medium">Drop the diagram here...</p>
              ) : (
                <>
                  <p className="font-medium text-zinc-900">Click to upload or drag and drop</p>
                  <p className="text-sm text-gray-500 mt-2 font-mono">
                    PDF, PNG, JPG, GIF up to 10MB
                  </p>
                </>
              )}
            </div>
            {!isDragActive && (
              <div className="mt-4">
                <button
                  type="button"
                  className="px-6 py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg shadow-md shadow-zinc-900/10 transition-colors font-medium"
                >
                  Choose file
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
