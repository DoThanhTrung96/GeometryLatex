
import React, { useState, useRef, useCallback } from 'react';
import { UploadIcon, SpinnerIcon } from './icons';

interface ImageUploaderProps {
  onImageUpload: (file: File) => void;
  disabled?: boolean;
  isProcessing?: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload, disabled = false, isProcessing = false }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file.');
        return;
      }
      setPreview(URL.createObjectURL(file));
      setFileName(file.name);
      onImageUpload(file);
    }
  };

  const handleDragOver = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (disabled) return;
    const file = event.dataTransfer.files?.[0];
    if (file) {
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file.');
            return;
        }
        setPreview(URL.createObjectURL(file));
        setFileName(file.name);
        onImageUpload(file);
    }
  }, [onImageUpload, disabled]);

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col items-center">
      <label
        htmlFor="file-upload"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`relative w-full h-48 border-2 border-dashed rounded-lg flex flex-col justify-center items-center text-center p-4 transition-colors duration-200 ${
          disabled ? 'cursor-not-allowed bg-slate-700/50 border-slate-600' : 'cursor-pointer bg-slate-800 hover:bg-slate-700/80 border-slate-600 hover:border-indigo-500'
        }`}
      >
        <input
          id="file-upload"
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept="image/*"
          disabled={disabled}
        />
        {isProcessing && (
          <div className="absolute inset-0 bg-slate-800/80 flex flex-col justify-center items-center rounded-lg">
            <SpinnerIcon />
            <p className="mt-2 text-slate-300">Preprocessing...</p>
          </div>
        )}

        {!isProcessing && preview ? (
          <img src={preview} alt="Preview" className="max-h-full max-w-full object-contain rounded-md" />
        ) : (
          !isProcessing && (
            <div className="text-slate-400">
              <UploadIcon className="mx-auto h-12 w-12" />
              <p className="mt-2">Drag & drop an image here</p>
              <p className="text-sm">or click to select a file</p>
            </div>
          )
        )}
      </label>
      {fileName && <p className="text-sm text-slate-400 mt-2 truncate max-w-full">{fileName}</p>}
    </div>
  );
};
