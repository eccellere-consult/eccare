export type MedicationFrequency =
  | 'once_daily'
  | 'twice_daily'
  | 'thrice_daily'
  | 'as_needed'
  | 'custom';

export type ReminderStatus = 'pending' | 'taken' | 'missed' | 'snoozed';

export interface Medication {
  id: string;
  userId: string;
  name: string;
  dosage: string;
  frequency: MedicationFrequency;
  timeSlots: string[];
  instructions?: string;
  prescribingDoctor?: string;
  isActive: boolean;
  createdAt: string;
}

export interface MedicationReminder {
  id: string;
  medicationId: string;
  userId: string;
  scheduledAt: string;
  status: ReminderStatus;
  takenAt?: string;
  medication?: Medication;
}

export interface Appointment {
  id: string;
  userId: string;
  doctorName: string;
  hospital?: string;
  specialty?: string;
  datetime: string;
  notes?: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface HealthNote {
  id: string;
  userId: string;
  createdById: string;
  content: string;
  createdAt: string;
}
