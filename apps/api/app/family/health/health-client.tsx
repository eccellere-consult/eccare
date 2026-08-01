'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import PrescriptionUpload from '@/components/prescription-upload';
import AppointmentsManager from '@/components/appointments-manager';

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  instructions?: string;
  prescribingDoctor?: string;
  createdAt: string;
}

interface Prescription {
  id: string;
  fileName: string;
  status: string;
  createdAt: string;
  medications: Medication[];
}

export default function HealthClient() {
  const [activeTab, setActiveTab] = useState<'prescriptions' | 'medications' | 'appointments'>('prescriptions');
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [prescRes, medsRes] = await Promise.all([
        fetch('/api/v1/health/prescriptions'),
        fetch('/api/v1/health/medications'),
      ]);

      const [prescData, medsData] = await Promise.all([
        prescRes.json(),
        medsRes.json(),
      ]);

      if (prescData.success) setPrescriptions(prescData.data);
      if (medsData.success) setMedications(medsData.data);
    } catch (err) {
      console.error('Failed to fetch health data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Health Management</h1>
        <p className="text-gray-600">
          Upload prescriptions, manage medications, and track appointments
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('prescriptions')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'prescriptions'
              ? 'border-b-2 border-primary-main text-primary-main'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Prescriptions ({prescriptions.length})
        </button>
        <button
          onClick={() => setActiveTab('medications')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'medications'
              ? 'border-b-2 border-primary-main text-primary-main'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Medications ({medications.length})
        </button>
        <button
          onClick={() => setActiveTab('appointments')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'appointments'
              ? 'border-b-2 border-primary-main text-primary-main'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Appointments
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'prescriptions' && (
        <div className="space-y-6">
          <PrescriptionUpload onUploadComplete={fetchData} />

          <div>
            <h2 className="text-xl font-semibold mb-4">Prescription History</h2>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : prescriptions.length === 0 ? (
              <Card className="p-8 text-center text-gray-500">
                <p>No prescriptions uploaded yet.</p>
                <p className="text-sm mt-2">Upload your first prescription above to get started.</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {prescriptions.map((prescription) => (
                  <Card key={prescription.id} className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold mb-1">{prescription.fileName}</h3>
                        <p className="text-sm text-gray-600">
                          Uploaded {new Date(prescription.createdAt).toLocaleDateString()}
                        </p>
                        <p className="text-sm mt-2">
                          Status:{' '}
                          <span
                            className={
                              prescription.status === 'processed'
                                ? 'text-green-600 font-medium'
                                : prescription.status === 'pending'
                                  ? 'text-yellow-600 font-medium'
                                  : 'text-red-600 font-medium'
                            }
                          >
                            {prescription.status}
                          </span>
                        </p>
                        {prescription.medications.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm font-medium text-gray-700">
                              Extracted Medications:
                            </p>
                            <ul className="mt-1 space-y-1">
                              {prescription.medications.map((med) => (
                                <li key={med.id} className="text-sm text-gray-600">
                                  • {med.name} - {med.dosage} ({med.frequency})
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'medications' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Active Medications</h2>
            <Button onClick={() => setActiveTab('prescriptions')}>
              Upload Prescription to Add Medications
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : medications.length === 0 ? (
            <Card className="p-8 text-center text-gray-500">
              <p>No active medications found.</p>
              <p className="text-sm mt-2">Upload a prescription to automatically add medications.</p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {medications.map((med) => (
                <Card key={med.id} className="p-4">
                  <h3 className="font-semibold text-lg mb-2">{med.name}</h3>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>
                      <span className="font-medium">Dosage:</span> {med.dosage}
                    </p>
                    <p>
                      <span className="font-medium">Frequency:</span> {med.frequency}
                    </p>
                    {med.instructions && (
                      <p>
                        <span className="font-medium">Instructions:</span> {med.instructions}
                      </p>
                    )}
                    {med.prescribingDoctor && (
                      <p>
                        <span className="font-medium">Doctor:</span> {med.prescribingDoctor}
                      </p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'appointments' && <AppointmentsManager />}
    </div>
  );
}
