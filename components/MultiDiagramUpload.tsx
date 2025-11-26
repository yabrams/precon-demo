'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertCircle, FileText, Copy } from 'lucide-react';

interface UploadedFile {
  url: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileHash: string;
  isDuplicate?: boolean;
  existingProjectId?: string;
  existingProjectName?: string;
  suggestedProjectName?: string;
  diagram?: any;
}

interface DiagramFile {
  diagramId: string;
  imageUrl: string;
  fileName: string;
  fileHash: string;
}

interface BatchExtractionResult {
  success: boolean;
  projectId?: string;
  projectName?: string;
  message: string;
  bidPackages?: Array<{
    id: string;
    name: string;
    category: string;
    itemCount: number;
    bidFormId: string;
  }>;
  extractionResults?: Array<{
    diagramId: string;
    success: boolean;
    itemCount: number;
    confidence: string;
    error?: string;
  }>;
}

interface MultiDiagramUploadProps {
  bcProjectId?: string;
  onExtractionComplete: (result: BatchExtractionResult) => void;
  onCancel: () => void;
}

export default function MultiDiagramUpload({
  bcProjectId,
  onExtractionComplete,
  onCancel,
}: MultiDiagramUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [instructions, setInstructions] = useState('');
  const [projectName, setProjectName] = useState('');
  const [duplicateHandling, setDuplicateHandling] = useState<'reuse' | 'copy'>('copy');
  const [useMockData, setUseMockData] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setUploading(true);
    const progressMap: { [key: string]: number } = {};

    try {
      const results: UploadedFile[] = [];

      // Upload files sequentially to handle duplicates properly
      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i];
        progressMap[file.name] = (i / acceptedFiles.length) * 100;
        setUploadProgress({ ...progressMap });

        const formData = new FormData();
        formData.append('file', file);
        if (bcProjectId) {
          formData.append('bcProjectId', bcProjectId);
        }

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          console.error(`Failed to upload ${file.name}`);
          continue;
        }

        const uploadedData = await uploadResponse.json();
        results.push(uploadedData);

        progressMap[file.name] = 100;
        setUploadProgress({ ...progressMap });
      }

      setUploadedFiles(results);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload files');
    } finally {
      setUploading(false);
      setUploadProgress({});
    }
  }, [bcProjectId]);

  const handleBatchExtract = async () => {
    if (uploadedFiles.length === 0) return;

    setExtracting(true);

    try {
      // Check for duplicates
      const hasDuplicates = uploadedFiles.some(f => f.isDuplicate);
      const firstDuplicate = uploadedFiles.find(f => f.isDuplicate);

      // Prepare diagram data
      const diagrams: DiagramFile[] = uploadedFiles.map(file => ({
        diagramId: file.diagram?.id || `temp_${Date.now()}_${Math.random()}`,
        imageUrl: file.url,
        fileName: file.fileName,
        fileHash: file.fileHash
      }));

      // Call batch extraction API
      const extractResponse = await fetch('/api/extract/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diagrams,
          bcProjectId: bcProjectId || null,
          createNewProject: !bcProjectId && !hasDuplicates,
          projectName: projectName || uploadedFiles[0].fileName.replace(/\.[^/.]+$/, ''),
          isDuplicate: hasDuplicates && duplicateHandling === 'copy',
          originalProjectId: firstDuplicate?.existingProjectId,
          useMockData
        }),
      });

      if (!extractResponse.ok) {
        throw new Error('Extraction failed');
      }

      const result = await extractResponse.json();
      onExtractionComplete(result);
    } catch (error) {
      console.error('Extraction error:', error);
      alert('Failed to extract bid data');
    } finally {
      setExtracting(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
    },
    multiple: true,
    disabled: uploadedFiles.length > 0 || uploading,
  });

  // Show upload progress
  if (uploading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-2xl p-8 bg-white rounded-xl shadow-lg">
          <h3 className="text-lg font-semibold text-zinc-900 mb-6">Uploading Files...</h3>
          <div className="space-y-3">
            {Object.entries(uploadProgress).map(([fileName, progress]) => (
              <div key={fileName} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 truncate max-w-md">{fileName}</span>
                  <span className="text-gray-500">{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-zinc-900 h-2 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show uploaded files and extraction options
  if (uploadedFiles.length > 0) {
    const duplicateFiles = uploadedFiles.filter(f => f.isDuplicate);
    const newFiles = uploadedFiles.filter(f => !f.isDuplicate);

    return (
      <div className="w-full h-full flex">
        {/* Left side - File List */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex-1 bg-gray-50 p-6 overflow-auto"
        >
          <h3 className="text-lg font-semibold text-zinc-900 mb-4">
            Uploaded Files ({uploadedFiles.length})
          </h3>

          {duplicateFiles.length > 0 && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertCircle className="text-yellow-600 mt-0.5" size={20} />
                <div className="flex-1">
                  <p className="font-medium text-yellow-900">Duplicate Files Detected</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    {duplicateFiles.length} file(s) have been uploaded before.
                  </p>
                  <div className="mt-3 space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        value="copy"
                        checked={duplicateHandling === 'copy'}
                        onChange={(e) => setDuplicateHandling(e.target.value as 'copy' | 'reuse')}
                        className="text-zinc-600 focus:ring-zinc-500"
                      />
                      <span className="text-sm text-yellow-700">
                        Create a copy with "COPY X" prefix
                      </span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        value="reuse"
                        checked={duplicateHandling === 'reuse'}
                        onChange={(e) => setDuplicateHandling(e.target.value as 'copy' | 'reuse')}
                        className="text-zinc-600 focus:ring-zinc-500"
                      />
                      <span className="text-sm text-yellow-700">
                        Reuse existing extracted data
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {uploadedFiles.map((file, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`p-4 bg-white border rounded-lg ${
                  file.isDuplicate ? 'border-yellow-300' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <FileText className="text-gray-400 mt-0.5" size={20} />
                    <div>
                      <p className="font-medium text-gray-900">{file.fileName}</p>
                      <p className="text-sm text-gray-500">
                        {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                      </p>
                      {file.isDuplicate && (
                        <div className="mt-2 flex items-center space-x-1 text-sm">
                          <Copy className="text-yellow-600" size={14} />
                          <span className="text-yellow-700">
                            Original: {file.existingProjectName}
                          </span>
                          {duplicateHandling === 'copy' && (
                            <span className="text-yellow-700">
                              → {file.suggestedProjectName}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    {file.isDuplicate ? (
                      <AlertCircle className="text-yellow-500" size={20} />
                    ) : (
                      <CheckCircle className="text-green-500" size={20} />
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Right side - Extraction Options */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="flex-1 flex flex-col bg-white p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-zinc-900">
              Extraction Options
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
                    Diagrams will be uploaded but AI analysis will be skipped.
                    Instead, 5-8 CSI-based bid packages with realistic mock data will be generated for testing.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 space-y-4">
            {!bcProjectId && newFiles.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Enter project name..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Instructions (Optional)
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Add specific instructions for the AI extractor...&#10;&#10;Examples:&#10;- Focus on specific trades&#10;- Group items by location&#10;- Extract from specific areas"
                className="w-full h-32 p-4 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500"
                disabled={useMockData}
              />
            </div>

            <div className={`p-4 border rounded-lg ${useMockData ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
              <h4 className={`font-medium mb-2 ${useMockData ? 'text-amber-900' : 'text-blue-900'}`}>
                {useMockData ? 'Mock Mode - What will happen:' : 'What will happen:'}
              </h4>
              <ul className={`text-sm space-y-1 ${useMockData ? 'text-amber-700' : 'text-blue-700'}`}>
                {useMockData ? (
                  <>
                    <li>• Upload all {uploadedFiles.length} files (no AI processing)</li>
                    <li>• Generate 5-8 random CSI-based bid packages</li>
                    <li>• Create 3-20 mock line items per package</li>
                    <li>• Match items to CSI codes automatically</li>
                    <li>• Save mock data to the database</li>
                  </>
                ) : (
                  <>
                    <li>• Extract bid items from all {uploadedFiles.length} files</li>
                    <li>• Automatically categorize items by trade</li>
                    <li>• Create bid packages for each trade category</li>
                    <li>• Save all data to the database</li>
                    {duplicateFiles.length > 0 && duplicateHandling === 'copy' && (
                      <li>• Create copies of {duplicateFiles.length} duplicate project(s)</li>
                    )}
                    {duplicateFiles.length > 0 && duplicateHandling === 'reuse' && (
                      <li>• Reuse existing data for {duplicateFiles.length} duplicate(s)</li>
                    )}
                  </>
                )}
              </ul>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => {
                setUploadedFiles([]);
                setInstructions('');
                setProjectName('');
                setUseMockData(false);
                onCancel();
              }}
              className="px-6 py-3 bg-white hover:bg-gray-50 text-zinc-900 border border-gray-200 rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleBatchExtract}
              disabled={extracting}
              className="flex-1 px-6 py-3 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-all font-medium disabled:opacity-50"
            >
              {extracting ? 'Processing...' : useMockData ? `Generate Mock Data →` : `Process ${uploadedFiles.length} Files →`}
            </button>
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
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all w-full max-w-2xl bg-white
          ${isDragActive ? 'border-zinc-500 bg-zinc-50' : 'border-gray-300 hover:border-zinc-400 hover:shadow-md'}`}
      >
        <input {...getInputProps()} />

        <div className="space-y-4">
          <svg
            className="mx-auto h-16 w-16 text-gray-400"
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
              <p className="text-zinc-900 font-medium text-lg">Drop your diagrams here...</p>
            ) : (
              <>
                <p className="font-medium text-zinc-900 text-lg">
                  Upload Multiple Diagrams
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Click to select or drag and drop multiple files
                </p>
                <p className="text-xs text-gray-400 mt-1 font-mono">
                  PDF, PNG, JPG, GIF, WEBP • Max 10MB each
                </p>
              </>
            )}
          </div>
          {!isDragActive && (
            <div className="mt-6">
              <button
                type="button"
                className="px-8 py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg shadow-md shadow-zinc-900/10 transition-colors font-medium"
              >
                Choose Files
              </button>
            </div>
          )}
          <div className="mt-6 flex items-center justify-center space-x-6 text-xs text-gray-400">
            <div className="flex items-center space-x-1">
              <CheckCircle size={14} />
              <span>Duplicate detection</span>
            </div>
            <div className="flex items-center space-x-1">
              <FileText size={14} />
              <span>Batch processing</span>
            </div>
            <div className="flex items-center space-x-1">
              <CheckCircle size={14} />
              <span>Auto-categorization</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}