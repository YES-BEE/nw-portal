import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: { main: '#0957f7', dark: '#0045d4' },
    text: { primary: '#091832', secondary: '#65718a' },
    background: { default: '#00102d', paper: '#ffffff' },
  },
  typography: { fontFamily: 'Arial, Helvetica, sans-serif' },
  shape: { borderRadius: 5 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, minHeight: 47 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          height: 47,
          fontSize: 13,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#d9dfe9' },
          '&.Mui-focused': { boxShadow: '0 0 0 3px #1461f51c' },
        },
      },
    },
  },
});
