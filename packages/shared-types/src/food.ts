export type FoodRequestStatus = 'requested' | 'handled' | 'cancelled';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface FoodRequest {
  id: string;
  userId: string;
  requestType: string;
  notes?: string;
  status: FoodRequestStatus;
  handledBy?: string;
  createdAt: string;
}

export interface MealReminder {
  id: string;
  userId: string;
  mealType: MealType;
  time: string;
  isActive: boolean;
}
