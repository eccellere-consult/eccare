export const colors = {
  primary: {
    main: '#00796B',
    dark: '#004D40',
    light: '#E0F2F1',
  },
  accent: {
    main: '#F57F17',
    dark: '#F9A825',
    light: '#FFF8E1',
  },
  emergency: {
    main: '#C62828',
    dark: '#B71C1C',
    light: '#FFEBEE',
  },
  success: {
    main: '#2E7D32',
    light: '#E8F5E9',
  },
  background: '#FFF8F0',
  surface: '#FFFFFF',
  text: '#212121',
  textSecondary: '#546E7A',
  border: '#B0BEC5',
  disabled: '#CFD8DC',
} as const;

export type Colors = typeof colors;
