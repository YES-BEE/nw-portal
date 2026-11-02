# NW Track Portal

React and TypeScript application built with Vite, Material UI, and React Router. The responsive login page follows the supplied `NW_Track_Login.html` reference and uses the supplied NoWash logo.

## Development

Use Node.js 22.12+ and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. `/` redirects to `/login`; unknown paths also redirect to `/login` until additional application routes are introduced.

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
  components/         # Shared presentation components
  features/
    auth/             # Login page, styling, decorative chart
  i18n/               # i18next setup, typed keys, English JSON strings
  App.tsx             # Router provider
  index.css           # Global base styles
  main.tsx            # React entry point and theme provider
```

Keep feature-specific components, styles, and behavior together. Add routes in `src/app/router.tsx` and shared design tokens in `src/app/theme.ts`. MUI supplies form controls, buttons, the language selector, and the card; feature CSS implements the reference layout and responsive treatment.

## Login behavior

The page includes required username/password fields, a password visibility toggle, and recovery feedback. Only English is supported. All application UI text is stored in `src/i18n/locales/en.json` and accessed through `react-i18next`, with typed translation keys, English fallback, and copyright year interpolation. The document language, title, and description are set from the same resources. The language indicator displays English without offering unsupported languages.

Authentication and password recovery are demonstration interactions, matching the reference. Submission displays a backend-not-connected message. Credentials are never persisted. Connect these controls to an authentication service before enabling actual sign-in.

## Tests

Vitest runs in jsdom with React Testing Library and user-event. Tests use the real MUI theme and i18next resources, and exercise login validation (including whitespace-only usernames), password visibility, keyboard submission, recovery feedback, credential storage behavior, English metadata and year interpolation, language fallback, and direct/redirected routes. They also guard against reintroducing the removed subtitle and remember-me checkbox.

Test files live beside the features they cover. Shared setup and the themed render helper are in `src/test/`. DOM tests do not verify browser layout or real authentication services.

## Deployment

Deploy the generated `dist/` directory. Configure the host to serve `index.html` for application routes such as `/login` so direct navigation and refresh work with browser history routing.
