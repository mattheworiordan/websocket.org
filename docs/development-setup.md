# Local Development Setup

This guide will help you set up your local development environment for
WebSocket.org.

## Prerequisites

### Required Software

- **Node.js**: Version 18.x or 20.x (check with `node --version`)
- **npm**: Version 8+ (comes with Node.js, check with `npm --version`)
- **Git**: For version control
- **VS Code**: Recommended editor (optional but recommended)

### Installing Node.js

#### Option 1: Using Node Version Manager (Recommended)

```bash
# Install nvm (macOS/Linux)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install Node.js 20 (LTS)
nvm install 20
nvm use 20
nvm alias default 20
```

#### Option 2: Direct Download

Download from [nodejs.org](https://nodejs.org/) and install the LTS version.

## Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/mattheworiordan/websocket.org.git
cd websocket.org
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required dependencies including:

- Astro framework
- Starlight documentation theme
- TypeScript
- Linting and formatting tools

### 3. Set Up Git Hooks (First Time Only)

```bash
npm run prepare
```

This sets up Husky for pre-commit hooks that will:

- Lint markdown files
- Check code formatting
- Run type checking

## Development Commands

### Start Development Server

```bash
npm run dev
# or
npm start
```

- Opens at http://localhost:4321
- Hot Module Replacement (HMR) enabled
- Auto-refreshes on content changes
- Shows build errors in browser

### Build Site

```bash
npm run build
```

- Type checks all TypeScript
- Builds static site to `./dist`
- Optimizes assets for production

### Preview Production Build

```bash
npm run preview
```

- Serves the built site from `./dist`
- Useful for testing production build locally
- Runs at http://localhost:4322

### Linting and Formatting

#### Check Markdown Files

```bash
npm run lint
```

#### Auto-fix Markdown Issues

```bash
npm run lint:fix
```

#### Format All Code

```bash
npm run format
```

#### Check Formatting

```bash
npm run format:check
```

## File Structure

```
websocket.org/
├── src/
│   ├── content/          # Markdown content files
│   │   └── docs/         # Documentation pages
│   │       ├── guides/   # Guide articles
│   │       ├── reference/# API references
│   │       ├── tools/    # Tool documentation
│   │       └── resources/# External resources
│   ├── components/       # Astro components
│   ├── templates/        # Content templates
│   └── assets/          # Images and static assets
├── public/              # Static files (served as-is)
│   └── images/         # Public images
├── dist/               # Built site (git ignored)
└── docs/              # Development documentation
```

## Working with Content

### Creating New Content

1. **Choose the appropriate template:**

   ```bash
   ls src/templates/
   ```

2. **Copy template to content location:**

   ```bash
   # For a new guide
   cp src/templates/guide-template.md src/content/docs/guides/my-new-guide.md
   ```

3. **Edit the file:**
   - Fill in frontmatter metadata
   - Replace placeholder text
   - Add your content

4. **Preview changes:**
   - Save the file
   - Browser auto-refreshes at http://localhost:4321

### Content Hot Reload

The development server automatically:

- Watches all files in `src/`
- Rebuilds on changes
- Refreshes browser via HMR
- Preserves scroll position
- Shows errors in browser overlay

## Environment Variables

Create a `.env` file for local configuration (if needed):

```bash
# .env
# Add any environment-specific variables here
```

**Note:** The `.env` file is git-ignored and should not be committed.

## Troubleshooting

### Port Already in Use

If port 4321 is already in use:

```bash
npm run dev -- --port 4322
```

### Clear Cache

If you encounter stale content or build issues:

```bash
rm -rf node_modules .astro dist
npm install
npm run dev
```

### Node Version Issues

Ensure you're using Node.js 18.x or 20.x:

```bash
node --version
# Should show v18.x.x or v20.x.x

# If using nvm, switch versions:
nvm use 20
```

### Git Hook Issues

If pre-commit hooks aren't running:

```bash
npx husky install
chmod +x .husky/pre-commit
```

### Build Errors

For TypeScript or build errors:

```bash
npm run astro check
```

## VS Code Setup

For the best development experience, install recommended extensions:

1. Open VS Code in the project directory:

   ```bash
   code .
   ```

2. Install recommended extensions when prompted, or manually install:
   - Astro
   - MDX
   - Prettier
   - ESLint
   - markdownlint

3. Workspace settings are automatically applied from `.vscode/settings.json`

## Getting Help

- **Astro Documentation**: https://docs.astro.build
- **Starlight Documentation**: https://starlight.astro.build
- **Project Issues**: https://github.com/mattheworiordan/websocket.org/issues
- **Content Style Guide**: `/docs/content-style-guide.md`

## Docker Development (Optional)

If you prefer using Docker for a consistent development environment:

### Using Docker Compose

1. **Start the development server:**

   ```bash
   docker-compose up
   ```

2. **Access the site:**
   - Development: http://localhost:4321
   - Preview: http://localhost:4322

3. **Run commands in container:**

   ```bash
   # Run linting
   docker-compose exec websocket-org npm run lint

   # Build the site
   docker-compose exec websocket-org npm run build

   # Format code
   docker-compose exec websocket-org npm run format
   ```

4. **Stop the container:**
   ```bash
   docker-compose down
   ```

### Using Dockerfile

Build and run manually:

```bash
# Build the image
docker build -t websocket-org .

# Run the container
docker run -p 4321:4321 -v $(pwd):/app websocket-org
```

**Note:** Docker is optional. The recommended approach is using Node.js directly
for better performance and simpler debugging.

## Next Steps

1. Read the [Content Style Guide](/docs/content-style-guide.md)
2. Review existing content in `src/content/docs/`
3. Check the
   [implementation plan](/internal/websocket-org-implementation-plan.md)
4. Start contributing!
