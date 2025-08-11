# readme-generator

[![License](https://img.shields.io/github/license/Shanidhya01/readme-generator)](LICENSE) [![Stars](https://img.shields.io/github/stars/Shanidhya01/readme-generator?style=flat)](https://github.com/Shanidhya01/readme-generator/stargazers) [![Issues](https://img.shields.io/github/issues/Shanidhya01/readme-generator)](https://github.com/Shanidhya01/readme-generator/issues) [![Last Commit](https://img.shields.io/github/last-commit/Shanidhya01/readme-generator)](https://github.com/Shanidhya01/readme-generator/commits)

## About

- Repository: https://github.com/Shanidhya01/readme-generator
- Homepage: https://readme-generator-five-sigma.vercel.app
- Default branch: `main`
- License: `N/A`

## Table of Contents

- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Languages](#languages)
- [Getting Started](#getting-started)
- [Scripts](#scripts)
- [Configuration](#configuration)
- [Folder Structure](#folder-structure)
- [Contributing](#contributing)
- [Roadmap](#roadmap)
- [Security](#security)
- [License](#license)
- [Acknowledgements](#acknowledgements)
- [FAQ](#faq)

## Features

- Production-ready structure
- DX-focused tooling
- Extensible configuration

## Tech Stack

- React
- Vite
- TypeScript
- Tailwind CSS
- ESLint

## Languages

- TypeScript: 96.3%
- CSS: 3.1%
- JavaScript: 0.4%
- HTML: 0.2%

## Getting Started

### Prerequisites

- Node.js (recommended LTS)
- BUN (or adjust commands for your package manager)

### Installation

```bash
# Clone the repo
git clone https://github.com/Shanidhya01/readme-generator.git
cd readme-generator

# Install dependencies
bun install
```

### Running Locally

```bash
# Start dev server
bun dev

# Build for production
bun build
```
## Scripts

| Script | Command | Description |
|---|---|---|
| dev | `vite` | Start development server |
| build | `vite build` | Build production assets |
| build:dev | `vite build --mode development` | vite build --mode development |
| lint | `eslint .` | Run linter |
| preview | `vite preview` | Preview production build locally |

### Dependencies

- @hookform/resolvers ^3.10.0
- @radix-ui/react-accordion ^1.2.11
- @radix-ui/react-alert-dialog ^1.1.14
- @radix-ui/react-aspect-ratio ^1.1.7
- @radix-ui/react-avatar ^1.1.10
- @radix-ui/react-checkbox ^1.3.2
- @radix-ui/react-collapsible ^1.1.11
- @radix-ui/react-context-menu ^2.2.15
- @radix-ui/react-dialog ^1.1.14
- @radix-ui/react-dropdown-menu ^2.1.15
- @radix-ui/react-hover-card ^1.1.14
- @radix-ui/react-label ^2.1.7
- @radix-ui/react-menubar ^1.1.15
- @radix-ui/react-navigation-menu ^1.2.13
- @radix-ui/react-popover ^1.1.14
- @radix-ui/react-progress ^1.1.7
- @radix-ui/react-radio-group ^1.3.7
- @radix-ui/react-scroll-area ^1.2.9
- @radix-ui/react-select ^2.2.5
- @radix-ui/react-separator ^1.1.7
- @radix-ui/react-slider ^1.3.5
- @radix-ui/react-slot ^1.2.3
- @radix-ui/react-switch ^1.2.5
- @radix-ui/react-tabs ^1.1.12
- @radix-ui/react-toast ^1.2.14
- @radix-ui/react-toggle ^1.1.9
- @radix-ui/react-toggle-group ^1.1.10
- @radix-ui/react-tooltip ^1.2.7
- @tanstack/react-query ^5.83.0
- class-variance-authority ^0.7.1
- clsx ^2.1.1
- cmdk ^1.1.1
- date-fns ^3.6.0
- embla-carousel-react ^8.6.0
- input-otp ^1.4.2
- lucide-react ^0.462.0
- next-themes ^0.3.0
- react ^18.3.1
- react-day-picker ^8.10.1
- react-dom ^18.3.1
- react-hook-form ^7.61.1
- react-resizable-panels ^2.1.9
- react-router-dom ^6.30.1
- recharts ^2.15.4
- sonner ^1.7.4
- tailwind-merge ^2.6.0
- tailwindcss-animate ^1.0.7
- vaul ^0.9.9
- zod ^3.25.76

### Dev Dependencies

- @eslint/js ^9.32.0
- @tailwindcss/typography ^0.5.16
- @types/node ^22.16.5
- @types/react ^18.3.23
- @types/react-dom ^18.3.7
- @vitejs/plugin-react-swc ^3.11.0
- autoprefixer ^10.4.21
- eslint ^9.32.0
- eslint-plugin-react-hooks ^5.2.0
- eslint-plugin-react-refresh ^0.4.20
- globals ^15.15.0
- lovable-tagger ^1.1.9
- postcss ^8.5.6
- tailwindcss ^3.4.17
- typescript ^5.8.3
- typescript-eslint ^8.38.0
- vite ^5.4.19

## Configuration

Common variables you may need (examples, edit for your project):

```env
NODE_ENV=development
PORT=3000
API_BASE_URL=http://localhost:3000
```

## Folder Structure

```text
├── .gitignore
├── bun.lockb
├── components.json
├── eslint.config.js
├── index.html
├── package-lock.json
├── package.json
├── postcss.config.js
├── public
│   ├── placeholder.svg
│   └── robots.txt
├── README.md
├── src
│   ├── App.css
│   ├── App.tsx
│   ├── components
│   │   ├── ReadmeGenerator.tsx
│   │   ├── ThemeToggle.tsx
│   │   └── ui
│   │       ├── accordion.tsx
│   │       ├── alert-dialog.tsx
│   │       ├── alert.tsx
│   │       ├── aspect-ratio.tsx
│   │       ├── avatar.tsx
│   │       ├── badge.tsx
│   │       ├── breadcrumb.tsx
│   │       ├── button.tsx
│   │       ├── calendar.tsx
│   │       ├── card.tsx
│   │       ├── carousel.tsx
│   │       ├── chart.tsx
│   │       ├── checkbox.tsx
│   │       ├── collapsible.tsx
│   │       ├── command.tsx
│   │       ├── context-menu.tsx
│   │       ├── dialog.tsx
│   │       ├── drawer.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── form.tsx
│   │       ├── hover-card.tsx
│   │       ├── input-otp.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── menubar.tsx
│   │       ├── navigation-menu.tsx
│   │       ├── pagination.tsx
│   │       ├── popover.tsx
│   │       ├── progress.tsx
│   │       ├── radio-group.tsx
│   │       ├── resizable.tsx
│   │       ├── scroll-area.tsx
│   │       ├── select.tsx
│   │       ├── separator.tsx
│   │       ├── sheet.tsx
│   │       ├── sidebar.tsx
│   │       ├── skeleton.tsx
│   │       ├── slider.tsx
│   │       ├── sonner.tsx
│   │       ├── switch.tsx
│   │       ├── table.tsx
│   │       ├── tabs.tsx
│   │       ├── textarea.tsx
│   │       ├── toast.tsx
│   │       ├── toaster.tsx
│   │       ├── toggle-group.tsx
│   │       ├── toggle.tsx
│   │       ├── tooltip.tsx
│   │       └── use-toast.ts
│   ├── hooks
│   │   ├── use-mobile.tsx
│   │   ├── use-toast.ts
│   │   └── useSEO.ts
│   ├── index.css
│   ├── lib
│   │   └── utils.ts
│   ├── main.tsx
│   ├── pages
│   │   ├── Index.tsx
│   │   └── NotFound.tsx
│   └── vite-env.d.ts
├── supabase
│   └── functions
│       └── generate-readme
│           └── index.ts
├── tailwind.config.ts
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
├── vercel.json
└── vite.config.ts
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Roadmap

- [ ] Add more generators
- [ ] Improve prompts and templates
- [ ] Add export formats (PDF/HTML)

## Security

If you discover a vulnerability, please open a private issue or contact the maintainers.
Never commit real secrets. Rotate any exposed credentials immediately.

## License

Distributed under the N/A License. See `LICENSE` for more information.

## Acknowledgements

- GitHub API
- shadcn/ui
- Tailwind CSS
- Supabase Edge Functions

## FAQ

- Why are some sections generic?
  - The generator infers content from repository metadata. Add topics, scripts, and a .env.example to improve results.
- How do I change package manager commands?
  - The generator tries to detect lockfiles. Adjust commands if needed.

---

> Generated with README Generator.
