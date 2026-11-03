# NW Track Portal

React and TypeScript application built with Vite, Material UI, and React Router. The responsive login page follows the supplied `NW_Track_Login.html` reference and uses the supplied NoWash logo.

## Development

Use Node.js 22.12+ and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. `/` redirects to `/login`. Configuration routes are `/configurations/processes`, `/configurations/storages`, and `/configurations/tags`; `/configurations` redirects to processes. Unknown paths redirect to `/login`.

## Commands

```sh
npm run build         # Type-check and generate dist/
npm run preview       # Serve the production build locally
npm run lint          # Run ESLint
npm run format        # Format the project with Prettier
npm run format:check  # Check formatting without modifying files
npm test              # Run unit and component tests once
npm run test:watch    # Rerun tests as files change
```

## Source structure

```text
src/
  app/                # Application router and shared MUI theme
  assets/             # Supplied brand assets
  features/
    auth/             # Login page, styling, decorative chart
    configurations/   # Shared NFC registry, details header, and summary components
    processes/        # Process list, editor, validation, local demo records
    storages/         # Storage list, editor, validation, local records
    tags/             # Tag management, assignment lookup, validation
  layouts/            # Responsive configuration shell and collapsible navigation
  i18n/               # i18next setup, typed keys, English JSON strings
  App.tsx             # Router provider
  index.css           # Global base styles
  main.tsx            # React entry point and theme provider
```

Keep feature-specific components, styles, and behavior together. Add routes in `src/app/router.tsx` and shared themes in `src/app/theme.ts`. MUI supplies form controls, buttons, cards, tables, and navigation. The configuration shell and page load lazily, with a light workspace theme scoped to those routes.

Inter Variable is self-hosted through `@fontsource-variable/inter` and imported once in `src/main.tsx`. The shared MUI `typography.fontFamily`, root `ThemeProvider`, and `CssBaseline` apply it across the app; the configuration theme inherits it. Update the theme to change the app-wide font rather than adding component-level font-family overrides.

All interface icons come from `@mui/icons-material`. Icon-only actions use MUI `IconButton` with accessible labels, and compact process actions include tooltips. The drawer and AppBar share a toolbar height; submenu labels and workspace padding follow consistent alignment.

Application UI markup uses MUI components throughout, including `Box` for semantic containers and images, `Typography` for text, and `FormLabel` for login labels. The decorative production illustration is a static SVG asset rendered with `Box component="img"`. ESLint prevents native JSX UI tags in application components; MUI's `component` prop retains the appropriate underlying HTML semantics.

Login, process, storage, and tag forms show validation through MUI field `error` states and associated helper text. Submission reveals all relevant errors, and correcting a value updates its message. Device validation uses stable device IDs, with duplicate NFC errors shown on each affected dropdown. Device-count feedback is linked to the count input beneath its control row. Browser-storage failures and other page-level problems remain alerts.

Process and storage tables provide View, Edit, and Delete icon actions. View navigates to a dedicated read-only page: `/configurations/processes/:processId` or `/configurations/storages/:storageId`. Detail URLs support direct navigation and refresh, retain the active sidebar item, and provide explicit return links. Missing records display a message and a return link. Viewing details never writes records.

Process details show the saved tracking settings and a device table for device-level tracking. The table supports search by device name, description, or NFC tag, plus pagination with 10, 25, 50, or 100 rows per page. Searching resets pagination and handles empty results. Only the current page's devices are rendered; the complete record is loaded from browser storage.

## Login behavior

The page includes required username/password fields, a password visibility toggle, and recovery feedback. Only English is supported. All application UI text is stored in `src/i18n/locales/en.json` and accessed through `react-i18next`, with typed translation keys, English fallback, and copyright year interpolation. The document language, title, and description are set from the same resources. The MUI language selector offers English only. It shares a grid column with the sign-in card so their right edges align across screen sizes.

Authentication and password recovery are demonstration interactions, matching the reference. Submission displays a backend-not-connected message. Credentials are never persisted. Connect these controls to an authentication service before enabling actual sign-in.

## Process configurations

The configuration routes follow `NW_Track_Configurations_MUI_v8.html`. They share a full-height persistent MUI drawer on desktop with a header toggle and shifting AppBar/content, a temporary drawer on mobile, and a collapsible Configurations submenu. Process Configurations, Storage Configurations, and Tag Management are available, and the active route is highlighted. Logout sits at the bottom of the sidebar, independently of the collapsible submenu, and returns to `/login` using history replacement. Backend session termination is not implemented.

Processes support process-level or device-level tracking, device counts from 0 to 50 (at least one is required to save device-level tracking), required-field validation, unique registered NFC assignments, delete confirmation dialogs, and save notifications. Inactive NFC data is cleared on save. The shared tag registry includes available process/device/storage tags for new records. Storage tag assignments are read from actual saved storage records. Sample record names and identifiers are domain data; interface strings remain in the English translation resource. Table headings use title case through the shared MUI theme.

Records persist in browser storage under `nw-track-process-config-v3`, compatible with the process records in the HTML sample. Invalid saved data falls back to sample records with a warning. A failed write keeps the current records and editor intact. No backend or authentication is connected.

## Storage configurations

`/configurations/storages` provides the existing-storage table and add/edit form with Storage Number, Description, and a compact NFC Tag ID dropdown. It follows the shared outlined-field theme, static labels, MUI icon actions, title-case headings, and delete confirmations. There is no demo-reset button or table subtitle.

Storage numbers must be unique regardless of case, and NFC tags must be registered and unused by another storage, process, or device. Deleting a storage releases its tag for other configurations. Changes persist in browser storage under `nw-track-storages-v1`, compatible with the HTML reference. Failed writes keep existing records and the editor intact; malformed records fall back to the two reference records with a warning. No backend is connected.

## Tag management

`/configurations/tags` provides a searchable, paginated NFC registry with Tag Name, Actual NFC Tag ID, Assigned To, and edit/delete actions. Assignment links lead to the relevant process or storage detail page. New tags and updates persist under `nw-track-tags-v1`, compatible with the HTML reference; process and storage forms and validators read the same saved registry.

Tag names and NFC IDs must be unique regardless of case. Assigned tags can be renamed, but their physical IDs cannot change and they cannot be deleted until unassigned. Delete confirmation rechecks assignments before writing. When assignment records cannot be loaded, existing NFC ID changes and deletions are locked. Failed writes preserve the registry and editor. No backend is connected.

## Tests

Vitest runs in jsdom with React Testing Library and user-event, with two workers to limit concurrent DOM load. Tests cover login interactions and translations, form callbacks and field errors, process/storage validation and shared NFC assignments, storage recovery, creation/reload, cancelled edits, device mode, delete confirmation, failed writes, route navigation, sidebar logout, and the expandable MUI submenu. Detail-component tests cover read-only summaries, heading focus, return links, and device searching and pagination, including list changes. The decorative chart is checked for accessibility. Tests also guard against reintroducing removed controls.

Test files live beside the features they cover. Shared setup and the themed render helper are in `src/test/`. DOM tests do not verify browser layout or real authentication services.

## Deployment

Deploy the generated `dist/` directory. Configure the host to serve `index.html` for application routes such as `/login` so direct navigation and refresh work with browser history routing.
