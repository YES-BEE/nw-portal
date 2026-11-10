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
    overview/         # Dashboard and Reports/Analysis coming-soon pages
    processes/        # Process list, editor, validation, local records
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

The login form sends `POST {VITE_API_BASE_URL}/api/{VITE_API_VERSION}/auth/login` with a JSON `LoginRequest` containing `username`, `password`, and `clientType`. Configure the backend in `.env` (see `.env.example`):

```dotenv
VITE_API_BASE_URL=http://192.168.0.106
VITE_API_VERSION=v1
VITE_AUTH_CLIENT_TYPE=PC
```

Restart Vite after changing environment values. Vite exposes these variables to the browser; they contain public configuration. `LoginRequest`, `LoginResponse`, and `LoginModule` are defined in `src/features/auth/types.ts`. Process assignments are retained as `unknown[]` because the provided response only specifies an empty array, without an item schema.

Successful responses are validated before starting a session. The session retains the access token, token type, roles, process assignments, module metadata and expiration time. Sidebar entries use each login response module?s `name` as their label and match its `key` to the existing app route and icon. Existing menu ordering and the Configurations group are retained. Known module keys from the response control protected routes, sidebar visibility and the landing page; unknown keys are retained in the response metadata and do not grant routes. Local role records do not control these permissions. The backend must authorize API operations. Because the login response provides no user ID, the canonical response username is used as the current identity key.

The form disables repeated submissions while login is pending and cancels pending requests when unmounted. Login HTTP error messages come from backend `detail`, `message`, `title`, or `error` fields, in that order, including authentication failures. Full Problem Detail metadata and a specific error code are not required to display a backend message. Known `fieldErrors` appear beside the corresponding inputs. Actual HTTP status determines the failure category. Plain-text backend errors are supported; HTML pages and malformed JSON are not displayed. If the backend provides no usable message, the UI displays HTTP status text or the status number. Network failures display the client's transport error text. Local validation and configuration errors remain frontend concerns. Login explicitly omits any inherited Authorization header. Passwords are never stored. The backend login response (including `accessToken`) and its absolute expiry are saved in `sessionStorage` under `nw-track-session-v2`, restoring the session and sidebar after refresh within the same tab. Restoration validates the saved response and preserves its original expiration time. Logout and expiry remove the saved session. If storage is blocked, login reports a session error. No refresh or server logout endpoint has been supplied. At startup, a one-time migration removes the prototype?s portal configuration, access, style and legacy session records from both local and session storage, preserving the new authenticated session and unrelated keys. Users with no recognized module permissions land at `/workspace`.

## Process configurations

The configuration routes follow `NW_Track_Configurations_MUI_v8.html`. They share a full-height persistent MUI drawer on desktop with a header toggle and shifting AppBar/content, a temporary drawer on mobile, and a collapsible Configurations submenu. Authorized navigation items are shown and the active route is highlighted. Logout sits at the bottom of the sidebar, independently of the collapsible submenu, clears the session, and returns to `/login` using history replacement.

Processes support process-level or device-level tracking, device counts from 0 to 50 (at least one is required to save device-level tracking), required-field validation, unique registered NFC assignments, delete confirmation dialogs, and save notifications. Inactive NFC data is cleared on save. The shared tag registry includes available process/device/storage tags for new records. Storage tag assignments are read from actual saved storage records. No process, device, storage, tag, style, user, role or role-to-module records are seeded. Table headings use title case through the shared MUI theme.

Records persist in browser storage under `nw-track-process-config-v4`. Missing data starts empty; invalid saved data shows an empty list with a warning. A failed write keeps the current records and editor intact. No backend is connected.

## Storage configurations

`/configurations/storages` provides the existing-storage table and add/edit form with Storage Number, Description, and a compact NFC Tag ID dropdown. It follows the shared outlined-field theme, static labels, MUI icon actions, title-case headings, and delete confirmations. There is no demo-reset button or table subtitle.

Storage numbers must be unique regardless of case, and NFC tags must be registered and unused by another storage, process, or device. Deleting a storage releases its tag for other configurations. Changes persist in browser storage under `nw-track-storages-v2`. Failed writes keep existing records and the editor intact; malformed records show an empty list with a warning. No backend is connected.

## Tag management

`/configurations/tags` provides a searchable, paginated NFC registry with Tag Name, Actual NFC Tag ID, Assigned To, and edit/delete actions. Assignment links lead to the relevant process or storage detail page. New tags and updates persist under `nw-track-tags-v2`; process and storage forms and validators read the same saved registry.

Tag names and NFC IDs must be unique regardless of case. Assigned tags can be renamed, but their physical IDs cannot change and they cannot be deleted until unassigned. Delete confirmation rechecks assignments before writing. When assignment records cannot be loaded, existing NFC ID changes and deletions are locked. Failed writes preserve the registry and editor. No backend is connected.

## User and role management

`/users` and `/roles` follow `NW_Track_Role_Based_Modules_v21.html`, using MUI throughout. The shared sidebar also links to `/dashboard` and `/reports`, each with a Coming soon message. Existing configuration URLs remain available.

User and role lists start empty. Management supports search, pagination, add/edit, status changes and confirmed deletion. New users select a role from the current registry, with optional process associations available regardless of role name. Usernames must be unique regardless of case.

Role management has no predefined roles or module assignments. All module checkboxes are available, including New Style. Existing role names remain fixed during editing. Any unassigned role can be deleted; assigned roles are protected and assignments are rechecked at confirmation.

User and role records temporarily persist together under `nw-track-access-v2`. Configuration and style records also retain local editing until their backend endpoints are integrated. These local records do not authenticate users or grant effective session permissions. Missing or invalid storage never restores sample records. The startup migration removes previous prototype records once, without deleting unrelated browser data.

## Style Management and New Style

`/styles` supports creating, viewing, editing, and deleting garment styles for users with Style Management access. `/new-style` uses the same workspace, form, process editor, and details components in an ownership-restricted mode: users can create styles and view only their own saved styles, without editing or deleting them. Module permissions, rather than role names, determine route access.

Both modules capture style number, creation date, description, client, garment count, lot count, weight per lot, manually entered average garment weight, and delivery date. Style numbers are unique regardless of case. Counts must be positive whole numbers; weights must be finite and positive; delivery must be on or after creation. Field validation uses MUI helper text.

The shared process editor uses drag and drop exclusively and shows linked station numbers automatically. Its searchable process library includes a nearby append drop area that stays above the independently scrolling process list, so adding to a long route never requires dragging to the bottom of the page. The library and selected route use bounded panes, displayed side by side from tablet widths; the library and append area remain stationary while the route scrolls. The route header shows the step count. Appending reveals the last step by scrolling only the selected-route pane. Edge dragging scrolls the route internally; page auto-scroll is reserved for the stacked phone layout. Users can also drag onto a visible step to insert before it and drag existing step handles to reorder. Selected processes appear as read-only cards with a removal action. There are no process dropdowns, editing fields, mode switches, quick-add buttons, or move buttons. Repeated processes receive independent step IDs. Mouse and touch sensors are supported; keyboard users can pick up/drop with Space, move steps with arrows, and cancel with Escape. Available processes can be keyboard-dragged to the end with Right/Down. Drag instructions and announcements are translated, and cancelled or out-of-target drops leave the sequence intact.

Every style needs at least one available process. Removed process references remain visible in read-only details and must be removed and replaced by dragging an available process before saving. Unverifiable process records block saves. Both style modules share the same drag-only builder, validation, and saved process-order format.

Search and pagination are available in both lists. Successful creation opens `/styles/:styleId` or `/new-style/:styleId` immediately, with a confirmation message and a shared MUI Lot Route Stepper. View actions open the same details screen. Every lot follows the displayed saved process order; the Stepper shows each process and linked station without implying execution progress or completion. Wide screens use a horizontally scrollable route, while smaller screens use a vertically scrollable route. All steps, including repeated or unavailable processes, remain in their original positions. The list shows process counts, and style details remain read-only. Own-mode detail URLs check ownership before rendering any record data. Creator IDs preserve ownership when usernames change; legacy `createdBy` records and style `code` fields from the click dummy are supported. Legacy records without a creator remain visible only in Style Management.

Records persist under `nw-track-styles-v2`. New records capture the authenticated creator, and management edits preserve that creator. Mutation handlers recheck current permissions and saved records. Failed writes keep the form intact, and malformed style storage blocks writes until restored.

## Tests

Vitest runs in jsdom with React Testing Library and user-event, with two workers to limit concurrent DOM load. Tests cover login interactions and translations, form callbacks and field errors, process/storage validation and shared NFC assignments, storage recovery, creation/reload, cancelled edits, device mode, delete confirmation, failed writes, route navigation, sidebar logout, and the expandable MUI submenu. Detail-component tests cover read-only summaries, heading focus, return links, and device searching and pagination, including list changes. The decorative chart is checked for accessibility. Tests also guard against reintroducing removed controls.

Authentication tests cover the login request contract, environment configuration, validated responses, HTTP and network failures, expiration, logout, cancelled requests, pending-form behavior, and navigation using backend permissions. Legacy browser sessions cannot authenticate users, and effective permissions remain independent of local role records. Existing UI tests seed test-only fixtures explicitly from `src/test/fixtures.ts`; application code never imports them. Test files live beside the features they cover. Shared setup and the themed render helper are in `src/test/`. DOM tests do not verify browser layout or real authentication services.

## Deployment

Deploy the generated `dist/` directory. Configure the host to serve `index.html` for application routes such as `/login` so direct navigation and refresh work with browser history routing.
