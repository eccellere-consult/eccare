export const colors = {
  primary: {
    main: '#085041',
    dark: '#04342C',
    light: '#E1F5EE',
    tint: '#9FE1CB',
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
  text: '#04342C',
  textSecondary: '#0F6E56',
  border: '#DAD7CE',
  disabled: '#CFD8DC',
} as const;

export type Colors = typeof colors;
