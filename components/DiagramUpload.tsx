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
  onExtractStart: (url: string, instructions?: string) => void;
}

export default function DiagramUpload({
  onUploadSuccess,
  onExtractStart,
}: DiagramUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [instructions, setInstructions] = useState('');

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setUploading(true);

    try {
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
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload file');
    } finally {
      setUploading(false);
    }
  }, [onUploadSuccess]);

  const handleExtract = () => {
    if (uploadedFile) {
      onExtractStart(uploadedFile.url, instructions);
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
          className="flex-1 bg-white flex items-center justify-center p-6 overflow-auto"
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
          className="flex-1 flex flex-col bg-gray-50 p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Instructions for AI (Optional)
          </h3>
          <div className="flex-1 flex flex-col bg-white rounded-lg shadow-lg p-6 border-2 border-gray-200">
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Add specific instructions for the AI extractor...&#10;&#10;Examples:&#10;- Focus on electrical items only&#10;- Include labor costs&#10;- Group items by room&#10;- Extract quantities from the legend"
              className="flex-1 w-full p-4 border-2 border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none text-gray-900"
            />
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => {
                  setUploadedFile(null);
                  setInstructions('');
                }}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleExtract}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md"
              >
                Start AI Extraction →
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Show upload dropzone
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors w-full max-w-2xl
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />

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
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
