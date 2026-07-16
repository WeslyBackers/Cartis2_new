import { useState, useRef, DragEvent } from 'react';

interface FileUploadProps {
  onUpload: (file: File) => void;
  accept?: string;
  maxSize?: number;
  disabled?: boolean;
}

export default function FileUpload({ 
  onUpload, 
  accept = '*/*',
  maxSize = 52428800, // 50MB default (increased for CAD/GIS files)
  disabled = false 
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFile = (file: File) => {
    // Check file size
    if (file.size > maxSize) {
      alert(`Bestand is te groot. Maximum grootte is ${(maxSize / 1024 / 1024).toFixed(1)} MB`);
      return;
    }

    onUpload(file);
  };

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        accept={accept}
        style={{ display: 'none' }}
        disabled={disabled}
      />
      
      <div
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{
          border: `3px dashed ${isDragging ? '#007bff' : '#0066cc'}`,
          borderRadius: '8px',
          padding: '1.25rem',
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          backgroundColor: isDragging ? '#cfe2ff' : disabled ? '#f8f9fa' : '#f0f7ff',
          transition: 'all 0.3s ease',
          opacity: disabled ? 0.6 : 1,
          boxShadow: isDragging ? '0 4px 12px rgba(0, 102, 204, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.1)',
          transform: isDragging ? 'scale(1.02)' : 'scale(1)',
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.borderColor = '#0056b3';
            e.currentTarget.style.backgroundColor = '#e7f3ff';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && !isDragging) {
            e.currentTarget.style.borderColor = '#0066cc';
            e.currentTarget.style.backgroundColor = '#f0f7ff';
          }
        }}
      >
        <div style={{ marginBottom: '0.5rem', fontSize: '2rem' }}>📎</div>
        <div style={{ color: '#0066cc', fontWeight: '600', marginBottom: '0.35rem', fontSize: '0.95rem' }}>
          Klik om een bestand te selecteren
        </div>
        <div style={{ color: '#495057', fontSize: '0.875rem', marginBottom: '0.35rem' }}>
          of sleep een bestand hierheen
        </div>
        <div style={{ color: '#6c757d', fontSize: '0.8rem', marginTop: '0.5rem', fontStyle: 'italic' }}>
          Max: {(maxSize / 1024 / 1024).toFixed(1)} MB
        </div>
        <div style={{ color: '#6c757d', fontSize: '0.75rem', marginTop: '0.15rem' }}>
          PDF, Word, Excel, Afbeeldingen, CAD (DWG/DXF), GIS (SHP), ZIP
        </div>
      </div>
    </div>
  );
}
