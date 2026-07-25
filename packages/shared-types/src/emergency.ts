export type SOSTriggerType = 'manual' | 'voice' | 'fall_detected';
export type SOSStatus = 'triggered' | 'acknowledged' | 'resolved' | 'false_alarm';

export interface SOSEvent {
  id: string;
  userId: string;
  triggerType: SOSTriggerType;
  lat?: number;
  lng?: number;
  address?: string;
  status: SOSStatus;
  acknowledgedBy?: string;
  createdAt: string;
  resolvedAt?: string;
}
