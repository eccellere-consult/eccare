'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface Appointment {
  id: string;
  doctorName: string;
  hospital?: string;
  specialty?: string;
  datetime: string;
  notes?: string;
  status: 'upcoming' | 'completed' | 'cancelled';
}

interface AppointmentsManagerProps {
  elderUserId?: string;
}

export default function AppointmentsManager({ elderUserId }: AppointmentsManagerProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    doctorName: '',
    hospital: '',
    specialty: '',
    datetime: '',
    notes: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAppointments();
  }, [elderUserId]);

  const fetchAppointments = async () => {
    try {
      const url = elderUserId
        ? `/api/v1/health/appointments?elderUserId=${elderUserId}`
        : '/api/v1/health/appointments';
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setAppointments(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const response = await fetch('/api/v1/health/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          elderUserId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setAppointments([data.data, ...appointments]);
        setFormData({ doctorName: '', hospital: '', specialty: '', datetime: '', notes: '' });
        setShowForm(false);
      } else {
        setError(data.error?.message || 'Failed to create appointment');
      }
    } catch (err) {
      setError('Failed to create appointment');
    }
  };

  const handleUpdateStatus = async (id: string, status: 'completed' | 'cancelled') => {
    try {
      const response = await fetch(`/api/v1/health/appointments?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();
      if (data.success) {
        setAppointments(appointments.map((apt) => (apt.id === id ? data.data : apt)));
      }
    } catch (err) {
      console.error('Failed to update appointment:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this appointment?')) return;

    try {
      const response = await fetch(`/api/v1/health/appointments?id=${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        setAppointments(appointments.filter((apt) => apt.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete appointment:', err);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading appointments...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Appointments</h2>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Appointment'}
        </Button>
      </div>

      {showForm && (
        <Card className="p-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label htmlFor="doctorName">Doctor Name *</Label>
              <Input
                id="doctorName"
                value={formData.doctorName}
                onChange={(e) => setFormData({ ...formData, doctorName: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="hospital">Hospital/Clinic</Label>
                <Input
                  id="hospital"
                  value={formData.hospital}
                  onChange={(e) => setFormData({ ...formData, hospital: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="specialty">Specialty</Label>
                <Input
                  id="specialty"
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                  placeholder="e.g., Cardiologist"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="datetime">Date & Time *</Label>
              <Input
                id="datetime"
                type="datetime-local"
                value={formData.datetime}
                onChange={(e) => setFormData({ ...formData, datetime: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
                rows={3}
                placeholder="Any additional notes..."
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full">
              Create Appointment
            </Button>
          </form>
        </Card>
      )}

      <div className="space-y-4">
        {appointments.length === 0 ? (
          <Card className="p-8 text-center text-gray-500">
            <p>No appointments scheduled yet.</p>
            <Button onClick={() => setShowForm(true)} className="mt-4" variant="outline">
              Schedule First Appointment
            </Button>
          </Card>
        ) : (
          appointments.map((appointment) => (
            <Card key={appointment.id} className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{appointment.doctorName}</h3>
                    <Badge
                      variant={
                        appointment.status === 'upcoming'
                          ? 'default'
                          : appointment.status === 'completed'
                            ? 'accent'
                            : 'muted'
                      }
                    >
                      {appointment.status}
                    </Badge>
                  </div>
                  
                  <div className="space-y-1 text-sm text-gray-600">
                    {appointment.specialty && <p>Specialty: {appointment.specialty}</p>}
                    {appointment.hospital && <p>Hospital: {appointment.hospital}</p>}
                    <p className="font-medium text-gray-900">
                      📅 {new Date(appointment.datetime).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                    {appointment.notes && (
                      <p className="mt-2 text-gray-700">{appointment.notes}</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  {appointment.status === 'upcoming' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(appointment.id, 'completed')}
                      >
                        Mark Completed
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(appointment.id, 'cancelled')}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(appointment.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
