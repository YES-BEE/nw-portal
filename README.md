# NW Track Portal

React and TypeScript application built with Vite, Material UI, and React Router. The responsive login page follows the supplied `NW_Track_Login.html` reference and uses the supplied NoWash logo.

## Development

Use Node.js 22.12+ and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. `/` redirects to `/login`. The workspace includes `/dashboard`, `/reports`, `/users`, `/roles`, `/styles`, and `/new-style`. Configuration routes are `/configurations/processes`, `/configurations/storages`, and `/configurations/tags`; `/configurations` redirects to processes. Unknown paths redirect to `/login`.

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
    access/           # User and role records, module permissions, management forms
    auth/             # Login page, styling, decorative chart
    configurations/   # Shared NFC registry, details header, and summary components
    overview/         # Dashboard and Reports coming-soon pages
    processes/        # Process list, editor, validation, local demo records
    storages/         # Storage list, editor, validation, local records
    styles/           # Shared style list, editor, ordered process route, and details
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

Sign-in uses the seven demo credentials from the role-based reference. Usernames are case-insensitive; passwords are exact. Inactive or deleted accounts cannot sign in. Authentication reads current user records, and permissions come from the user's current saved role. Invalid credentials and unavailable storage are reported through password-field helper text. Password recovery remains unconfigured.

| Role               | Username             | Demo password      |
| ------------------ | -------------------- | ------------------ |
| NW                 | `nw.admin`           | `NW@2026demo`      |
| IT Admin           | `it.admin`           | `IT@2026demo`      |
| Top Manager        | `top.manager`        | `Top@2026demo`     |
| Production Manager | `production.manager` | `Prod@2026demo`    |
| Supervisor         | `supervisor`         | `Super@2026demo`   |
| Process Manager    | `process.manager`    | `Process@2026demo` |
| Style Configurator | `style.configurator` | `Style@2026demo`   |

Only the user ID is stored in `sessionStorage` under `nw-track-session-v1`; passwords are not written to browser storage. The session survives refresh in the current tab and is cleared by Logout. Renaming a reference user retains that account's demo password. Newly created management records do not have demo passwords and cannot sign in until credential provisioning is added.

Every workspace route, including configuration and style details, requires a session and the relevant module permission. Anonymous deep links redirect to sign-in, then return to the requested URL if the role permits it. Other sign-ins open the first available module. Unauthorized URLs show Access denied; inaccessible sidebar links are hidden. Roles without implemented modules land at `/workspace` with a No modules available message. This includes Process Manager with its reference permissions; Style Configurator lands at `/new-style`. Permission and user-status changes take effect in open screens; deactivated sessions must sign in again after reactivation. Invalid saved access data fails closed for authentication.

This is browser-only demo authentication with credentials included in the client source. Production security requires a backend identity service and server-side authorization.

## Process configurations

The configuration routes follow `NW_Track_Configurations_MUI_v8.html`. They share a full-height persistent MUI drawer on desktop with a header toggle and shifting AppBar/content, a temporary drawer on mobile, and a collapsible Configurations submenu. Authorized navigation items are shown and the active route is highlighted. Logout sits at the bottom of the sidebar, independently of the collapsible submenu, clears the session, and returns to `/login` using history replacement.

Processes support process-level or device-level tracking, device counts from 0 to 50 (at least one is required to save device-level tracking), required-field validation, unique registered NFC assignments, delete confirmation dialogs, and save notifications. Inactive NFC data is cleared on save. The shared tag registry includes available process/device/storage tags for new records. Storage tag assignments are read from actual saved storage records. Sample record names and identifiers are domain data; interface strings remain in the English translation resource. Table headings use title case through the shared MUI theme.

Records persist in browser storage under `nw-track-process-config-v3`, compatible with the process records in the HTML sample. Invalid saved data falls back to sample records with a warning. A failed write keeps the current records and editor intact. No backend is connected.

## Storage configurations

`/configurations/storages` provides the existing-storage table and add/edit form with Storage Number, Description, and a compact NFC Tag ID dropdown. It follows the shared outlined-field theme, static labels, MUI icon actions, title-case headings, and delete confirmations. There is no demo-reset button or table subtitle.

Storage numbers must be unique regardless of case, and NFC tags must be registered and unused by another storage, process, or device. Deleting a storage releases its tag for other configurations. Changes persist in browser storage under `nw-track-storages-v1`, compatible with the HTML reference. Failed writes keep existing records and the editor intact; malformed records fall back to the two reference records with a warning. No backend is connected.

## Tag management

`/configurations/tags` provides a searchable, paginated NFC registry with Tag Name, Actual NFC Tag ID, Assigned To, and edit/delete actions. Assignment links lead to the relevant process or storage detail page. New tags and updates persist under `nw-track-tags-v1`, compatible with the HTML reference; process and storage forms and validators read the same saved registry.

Tag names and NFC IDs must be unique regardless of case. Assigned tags can be renamed, but their physical IDs cannot change and they cannot be deleted until unassigned. Delete confirmation rechecks assignments before writing. When assignment records cannot be loaded, existing NFC ID changes and deletions are locked. Failed writes preserve the registry and editor. No backend is connected.

## User and role management

`/users` and `/roles` follow `NW_Track_Role_Based_Modules_v21.html`, using MUI throughout. The shared sidebar also links to `/dashboard` and `/reports`, each with a Coming soon message. Existing configuration URLs remain available.

Seven reference users are seeded: `nw.admin` (NW), `it.admin` (IT Admin), `top.manager` (Top Manager), `production.manager` (Production Manager), `supervisor` (Supervisor), `process.manager` (Process Manager), and `style.configurator` (Style Configurator). All start Active. User management supports search, pagination, add/edit, status changes, and confirmed deletion. New users select a role from the current role registry. Usernames must be unique regardless of case.

Role management seeds the reference permissions, including no access for Process Manager and New Style access for Style Configurator. Add roles and edit module checkboxes; existing role names remain fixed. Built-in roles cannot be deleted, and custom roles must be unassigned before deletion. Deletion rechecks current assignments at confirmation. Style Management and New Style are separate module permissions.

User and role records persist together under `nw-track-access-v1` so assignments stay consistent. Reads validate the saved schema, with a warning and reference-record fallback for invalid data. Failed writes preserve the editor. Saved roles and account status control the demo session, route access, and sidebar visibility.

## Style Management and New Style

`/styles` supports creating, viewing, editing, and deleting garment styles for users with Style Management access (NW, IT Admin, and Production Manager by default). `/new-style` uses the same workspace, form, process editor, and details components in an ownership-restricted mode: users can create styles and view only their own saved styles, without editing or deleting them. Style Configurator has this permission by default. Module permissions, rather than role names, determine route access.

Both modules capture style number, creation date, description, client, garment count, lot count, weight per lot, manually entered average garment weight, and delivery date. Style numbers are unique regardless of case. Counts must be positive whole numbers; weights must be finite and positive; delivery must be on or after creation. Field validation uses MUI helper text.

The shared process editor selects saved Process Configurations and shows linked station numbers automatically. Processes can be added, moved up/down, removed, and repeated in the route. Every style needs at least one available process. Removed process references remain visible in read-only details and must be replaced before saving an edit. Unverifiable process records block saves.

Search and pagination are available in both lists. View opens `/styles/:styleId` or `/new-style/:styleId` with read-only details and a paginated ordered process table. The list shows process counts; the detail page shows each step and linked station. Own-mode detail URLs check ownership before rendering any record data. Creator IDs preserve ownership when usernames change; legacy `createdBy` records and style `code` fields from the click dummy are supported. Legacy records without a creator remain visible only in Style Management.

Records persist under the reference key `nw-track-demo-styles-v1`. New records capture the authenticated creator, and management edits preserve that creator. Mutation handlers recheck current permissions and saved records. Failed writes keep the form intact, and malformed style storage blocks writes until restored.

## Tests

Vitest runs in jsdom with React Testing Library and user-event, with two workers to limit concurrent DOM load. Tests cover login interactions and translations, form callbacks and field errors, process/storage validation and shared NFC assignments, storage recovery, creation/reload, cancelled edits, device mode, delete confirmation, failed writes, route navigation, sidebar logout, and the expandable MUI submenu. Detail-component tests cover read-only summaries, heading focus, return links, and device searching and pagination, including list changes. The decorative chart is checked for accessibility. Tests also guard against reintroducing removed controls.

Authentication tests cover all seven accounts, exact passwords, session persistence and logout, malformed storage, inactive/deleted users, permitted deep-link restoration, unauthorized direct URLs, hidden navigation, and live permission changes. Test files live beside the features they cover. Shared setup and the themed render helper are in `src/test/`. DOM tests do not verify browser layout or real authentication services.

## Deployment

Deploy the generated `dist/` directory. Configure the host to serve `index.html` for application routes such as `/login` so direct navigation and refresh work with browser history routing.
