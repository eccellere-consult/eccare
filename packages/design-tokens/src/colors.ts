export const colors = {
  primary: {
    main: '#0B5563',
    dark: '#052E36',
    light: '#E1F2F4',
    tint: '#A8DCE3',
  },
  accent: {
    main: '#854F0B',
    dark: '#633806',
    light: '#FAEEDA',
    tint: '#FAC775',
  },
  emergency: {
    main: '#A32D2D',
    dark: '#791F1F',
    light: '#FCEBEB',
    tint: '#F7C1C1',
  },
  success: {
    main: '#3B6D11',
    light: '#EAF3DE',
  },
  background: '#F8F7F3',
  surface: '#FFFFFF',
  text: '#052E36',
  textSecondary: '#0E6B78',
  border: '#DAD7CE',
  disabled: '#CFD8DC',
} as const;

export type Colors = typeof colors;
