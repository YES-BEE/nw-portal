import { createTheme } from '@mui/material/styles';
import type {} from '@mui/x-date-pickers/themeAugmentation';

export const theme = createTheme({
  palette: {
    primary: { main: '#0957f7', dark: '#0045d4' },
    text: { primary: '#091832', secondary: '#65718a' },
    background: { default: '#00102d', paper: '#ffffff' },
  },
  typography: {
    fontFamily: '"Inter Variable", Arial, Helvetica, sans-serif',
    body1: { fontSize: 13 },
    body2: { fontSize: 13 },
    button: { fontSize: 13 },
  },
  shape: { borderRadius: 5 },
  components: {
    MuiDatePicker: { defaultProps: { format: 'DD/MM/YYYY' } },
    MuiTimePicker: { defaultProps: { ampm: false } },
    MuiDateTimePicker: {
      defaultProps: { format: 'DD/MM/YYYY HH:mm', ampm: false },
    },
    MuiPickersTextField: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        root: {
          '& .MuiInputLabel-root': {
            position: 'static',
            transform: 'none',
            marginBottom: 10,
          },
          '& .MuiPickersOutlinedInput-notchedOutline': {
            top: 0,
            '& legend': { display: 'none' },
          },
        },
      },
    },
    MuiPickersOutlinedInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          height: 47,
          minHeight: 47,
          fontSize: 13,
          borderRadius: theme.shape.borderRadius,
          '& .MuiPickersOutlinedInput-notchedOutline': {
            borderColor: '#d9dfe9',
          },
          '&.Mui-focused': { boxShadow: '0 0 0 3px #1461f51c' },
          '& .MuiIconButton-root': { color: theme.palette.primary.main },
        }),
      },
    },
    MuiPickersLayout: {
      styleOverrides: {
        root: ({ theme }) => ({
          color: theme.palette.text.primary,
          backgroundColor: theme.palette.background.paper,
          border: '1px solid #e1e7f0',
          borderRadius: 10,
          fontFamily: theme.typography.fontFamily,
          '& .MuiPickersCalendarHeader-label': {
            fontSize: 14,
            fontWeight: 700,
          },
          '& .MuiPickersDay-root, & .MuiPickerDay-root': { fontSize: 13 },
          '& .MuiPickersDay-root.Mui-selected, & .MuiPickerDay-root.Mui-selected':
            {
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
            },
          '& .MuiPickersToolbar-root': {
            backgroundColor: '#edf4ff',
            color: theme.palette.text.primary,
          },
          '& .MuiPickersActionBar-root': {
            borderTop: '1px solid #e1e7f0',
            padding: 12,
          },
          '& .MuiPickersActionBar-root .MuiButton-root': { minHeight: 36 },
        }),
      },
    },
    MuiAlertTitle: {
      styleOverrides: { root: { fontSize: 16 } },
    },
    MuiFormLabel: {
      styleOverrides: { root: { fontSize: 13 } },
    },
    MuiInputBase: {
      styleOverrides: { root: { fontSize: 13 } },
    },
    MuiAutocomplete: {
      styleOverrides: {
        inputRoot: {
          minHeight: 47,
          '&.MuiOutlinedInput-root': { paddingTop: 0, paddingBottom: 0 },
          '&.MuiAutocomplete-inputRoot[class*="MuiOutlinedInput-root"] .MuiAutocomplete-input':
            {
              paddingTop: 0,
              paddingBottom: 0,
            },
        },
        root: {
          '& .MuiAutocomplete-inputRoot:has(.MuiAutocomplete-tag)': {
            height: 'auto',
          },
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          fontSize: 13,
          '& .MuiTypography-root, & .MuiAlert-message': { fontSize: 13 },
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: ({ theme }) => ({
          fontSize: 16,
          fontWeight: 600,
          borderBottom: `1px solid ${theme.palette.divider}`,
          marginBottom: theme.spacing(2),
        }),
      },
    },
    MuiDialogContentText: {
      defaultProps: { variant: 'body2' },
      styleOverrides: { root: { fontSize: 13 } },
    },
    MuiSelect: {
      defaultProps: { displayEmpty: true },
    },
    MuiMenuItem: {
      styleOverrides: { root: { fontSize: 13 } },
    },
    MuiTableCell: {
      styleOverrides: {
        body: {
          fontSize: 13,
          '& .MuiTypography-root, & .MuiChip-root, & .MuiLink-root, & .MuiButton-root':
            {
              fontSize: 'inherit',
            },
        },
        head: {
          textTransform: 'capitalize',
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: 0.4,
          color: '#697b96',
          backgroundColor: '#f7f9fc',
        },
        stickyHeader: { backgroundColor: '#f7f9fc' },
      },
    },
    MuiTablePagination: {
      styleOverrides: {
        root: { fontSize: 13 },
        selectLabel: { fontSize: 13 },
        displayedRows: { fontSize: 13 },
        select: { fontSize: 13 },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        slotProps: {
          inputLabel: { shrink: true, disableAnimation: true },
          input: { notched: false },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: { root: { marginLeft: 0, marginRight: 0 } },
    },
    MuiInputLabel: {
      defaultProps: { shrink: true, disableAnimation: true },
      styleOverrides: {
        root: ({ theme }) => ({
          position: 'static',
          transform: 'none',
          transition: 'none',
          maxWidth: '100%',
          marginBottom: 10,
          fontSize: 13,
          fontWeight: 700,
          color: theme.palette.text.primary,
          pointerEvents: 'auto',
          '&.MuiInputLabel-shrink': { transform: 'none', maxWidth: '100%' },
          '&.Mui-focused': { color: theme.palette.text.primary },
          '&.Mui-error': { color: theme.palette.error.main },
        }),
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          fontSize: 13,
          minHeight: 47,
        },
      },
    },
    MuiOutlinedInput: {
      defaultProps: { notched: false },
      styleOverrides: {
        notchedOutline: {
          top: 0,
          '& legend': { display: 'none' },
        },
        root: {
          height: 47,
          '&.MuiInputBase-sizeSmall': { height: 47 },
          '&.MuiInputBase-multiline': { height: 'auto' },
          fontSize: 13,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#d9dfe9' },
          '&.Mui-focused': { boxShadow: '0 0 0 3px #1461f51c' },
        },
      },
    },
  },
});

export const configurationTheme = createTheme(theme, {
  palette: {
    background: { default: '#f5f7fb', paper: '#ffffff' },
    text: { primary: '#17243b', secondary: '#697b96' },
    divider: '#e1e7f0',
  },
  components: {
    MuiButton: { styleOverrides: { root: { minHeight: 40 } } },
  },
});
