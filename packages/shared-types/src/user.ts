import type { FontSizePreference } from '@ec/design-tokens';

export type UserRole = 'elder' | 'caregiver' | 'admin' | 'provider';

export type Relationship =
  | 'son'
  | 'daughter'
  | 'spouse'
  | 'grandchild'
  | 'sibling'
  | 'caregiver'
  | 'neighbor'
  | 'friend'
  | 'other';

export interface User {
  id: string;
  phone?: string;
  email?: string;
  name: string;
  avatarUrl?: string;
  role: UserRole;
  language: string;
  fontSizePref: FontSizePreference;
  highContrast: boolean;
  voiceEnabled: boolean;
  bloodGroup?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  lat?: number;
  lng?: number;
  createdAt: string;
  updatedAt: string;
}

export interface FamilyRelation {
  id: string;
  elderUserId: string;
  caregiverUserId: string;
  relationship: Relationship;
  canViewHealth: boolean;
  canManageMeds: boolean;
  receivesSos: boolean;
  receivesCheckin: boolean;
  inviteStatus: 'pending' | 'accepted' | 'declined';
  elderUser?: User;
  caregiverUser?: User;
}

export interface EmergencyContact {
  id: string;
  userId: string;
  name: string;
  phone: string;
  relationship: string;
  callOrder: number;
  notifyOnSos: boolean;
}
