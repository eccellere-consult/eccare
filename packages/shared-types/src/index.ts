export * from './user';
export * from './health';
export * from './emergency';
export * from './food';
export * from './voice';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}
