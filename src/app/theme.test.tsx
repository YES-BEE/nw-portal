import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MenuItem, TextField, ThemeProvider } from '@mui/material';
import { describe, expect, it } from 'vitest';
import { configurationTheme, theme } from './theme';

describe.each([
  { name: 'application', currentTheme: theme },
  { name: 'configuration workspace', currentTheme: configurationTheme },
])('$name field labels', ({ currentTheme }) => {
  it('keeps text and dropdown labels above their controls while empty, focused, and filled', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ThemeProvider theme={currentTheme}>
        <TextField label="Name" placeholder="Enter a name" />
        <TextField select label="Role" defaultValue="">
          <MenuItem disabled value="">
            Select a role
          </MenuItem>
          <MenuItem value="operator">Operator</MenuItem>
        </TextField>
      </ThemeProvider>,
    );
    function expectStaticLabels() {
      for (const label of Array.from(
        container.querySelectorAll('.MuiInputLabel-root'),
      )) {
        expect(label).toHaveStyle({
          position: 'static',
          transform: 'none',
          transition: 'none',
        });
      }
      for (const outline of Array.from(
        container.querySelectorAll('.MuiOutlinedInput-notchedOutline'),
      )) {
        expect(outline).toHaveStyle({ top: '0px' });
        expect(outline.querySelector('legend')).toHaveStyle({
          display: 'none',
        });
      }
    }
    expectStaticLabels();
    const name = screen.getByRole('textbox', { name: 'Name' });
    await user.click(name);
    expectStaticLabels();
    await user.type(name, 'Factory A');
    expectStaticLabels();
    await user.click(screen.getByRole('combobox', { name: 'Role' }));
    await user.click(screen.getByRole('option', { name: 'Operator' }));
    expectStaticLabels();
    await user.clear(name);
    await user.tab();
    expectStaticLabels();
  });

  it('keeps small, numeric, date, multiline, read-only, and invalid inputs statically labeled', () => {
    const { container } = render(
      <ThemeProvider theme={currentTheme}>
        <TextField label="Count" type="number" size="small" defaultValue="2" />
        <TextField label="Delivery" type="date" defaultValue="2026-11-30" />
        <TextField
          label="Description"
          multiline
          minRows={2}
          defaultValue="Style details"
        />
        <TextField
          label="Station"
          defaultValue="03"
          slotProps={{ input: { readOnly: true } }}
        />
        <TextField label="Client" error helperText="Enter a client." />
      </ThemeProvider>,
    );
    for (const label of Array.from(
      container.querySelectorAll('.MuiInputLabel-root'),
    ))
      expect(label).toHaveStyle({
        position: 'static',
        transform: 'none',
        transition: 'none',
      });
    for (const legend of Array.from(
      container.querySelectorAll('.MuiOutlinedInput-notchedOutline legend'),
    ))
      expect(legend).toHaveStyle({ display: 'none' });
    expect(
      screen.getByRole('textbox', { name: 'Client' }),
    ).toHaveAccessibleDescription('Enter a client.');
    expect(screen.getByRole('textbox', { name: 'Station' })).toHaveAttribute(
      'readonly',
    );
  });
});
