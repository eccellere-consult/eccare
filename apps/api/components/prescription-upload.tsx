'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

interface PrescriptionUploadProps {
  elderUserId?: string;
  onUploadComplete?: () => void;
}

export default function PrescriptionUpload({ elderUserId, onUploadComplete }: PrescriptionUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG, etc.)');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setError(null);
  };

  const handleUpload = async () => {
    if (!fileInputRef.current?.files?.[0]) {
      setError('Please select a file first');
      return;
    }

    const file = fileInputRef.current.files[0];
    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;

        const response = await fetch('/api/v1/health/prescriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            elderUserId,
            fileData: base64Data,
            fileName: file.name,
            fileType: file.type,
          }),
        });

        const data = await response.json();

        if (data.success) {
          setSuccess('Prescription uploaded successfully! Extracting medications...');
          setPreview(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          onUploadComplete?.();
        } else {
          setError(data.error?.message || 'Upload failed');
        }

        setUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      setError('Upload failed. Please try again.');
      setUploading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Upload Prescription</h3>
          <p className="text-sm text-gray-600">
            Upload a photo of the prescription. We'll automatically extract medications and appointments.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="prescription-file">Choose Prescription Image</Label>
            <input
              ref={fileInputRef}
              id="prescription-file"
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="mt-1 block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-primary-light file:text-primary-dark
                hover:file:bg-primary-tint cursor-pointer"
            />
          </div>

          {preview && (
            <div className="mt-4">
              <Label>Preview</Label>
              <div className="mt-2 border rounded-lg overflow-hidden max-w-md">
                <img src={preview} alt="Prescription preview" className="w-full h-auto" />
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
              {success}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              onClick={handleUpload}
              disabled={!preview || uploading}
              className="flex-1"
            >
              {uploading ? 'Uploading...' : 'Upload & Extract'}
            </Button>
            {preview && (
              <Button
                variant="outline"
                onClick={() => {
                  setPreview(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">What happens next?</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>✓ AI extracts all medications from the prescription</li>
            <li>✓ Medications are added to the elder's profile</li>
            <li>✓ Follow-up appointments are created automatically</li>
            <li>✓ You can review and edit the extracted data</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
