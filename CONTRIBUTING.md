# Contributing to WebSocket.org

First off, thank you for considering contributing to WebSocket.org! It's people
like you that make WebSocket.org such a great resource for the developer
community.

## About This Project

WebSocket.org is an open-source educational resource about WebSocket technology,
sponsored by [Ably](https://ably.com) and led by
[Matthew O'Riordan](https://github.com/mattheworiordan). We welcome
contributions from developers worldwide who are passionate about real-time web
technologies.

## Code of Conduct

This project and everyone participating in it is governed by our commitment to
providing a welcoming and inclusive environment. Please be respectful and
constructive in all interactions.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates.
When you create a bug report, include as many details as possible:

- Use a clear and descriptive title
- Describe the exact steps to reproduce the problem
- Provide specific examples to demonstrate the steps
- Describe the behavior you observed and what you expected to see
- Include screenshots if relevant

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an
enhancement suggestion:

- Use a clear and descriptive title
- Provide a step-by-step description of the suggested enhancement
- Provide specific examples to demonstrate the use case
- Explain why this enhancement would be useful to most users

### Your First Code Contribution

Unsure where to begin? Look for issues labeled:

- `good first issue` - Good for newcomers
- `help wanted` - Extra attention is needed
- `documentation` - Improvements or additions to documentation

### Pull Requests

1. Fork the repo and create your branch from `main`
2. Make your changes following our coding standards
3. Ensure your code follows the existing style
4. Test your changes locally
5. Issue that pull request!

## Development Setup

### Prerequisites

- Node.js 22 or higher (see `.nvmrc`)
- npm or yarn
- Git

### Local Development

````bash

# Clone your fork
git clone https://github.com/your-username/websocket.org.git
cd websocket.org

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```bash

### Project Structure

```text
websocket.org/
├── src/
│   ├── content/
│   │   ├── docs/         # Documentation pages
│   │   │   ├── guides/   # Guide articles
│   │   │   ├── reference/ # API references
│   │   │   ├── resources/ # Resource pages
│   │   │   └── tools/    # Tool documentation
│   ├── components/       # Astro components
│   └── layouts/          # Page layouts
├── public/              # Static assets
└── astro.config.mjs     # Astro configuration
````

## Writing Guidelines

### Content Structure

- **Guides**: Step-by-step tutorials and explanations
- **Reference**: Technical specifications and API documentation
- **Resources**: Links, tools, and community resources
- **Tools**: Interactive tools and utilities

### Markdown Guidelines

When creating content pages:

- **DO NOT** add a top-level heading (`# Title`) - the page title is
  automatically generated from the frontmatter
- Start with frontmatter containing `title` and `description`
- Use heading levels starting from `## H2` for sections
- Include code examples where relevant
- Add links to related content

Example:

```markdown
---
title: Your Page Title
description: A brief description of the page content
---

Start your content here without adding # Your Page Title again.

## First Section

Your content...
```

### Code Style

- Use consistent indentation (2 spaces for JavaScript/TypeScript)
- Follow existing patterns in the codebase
- Include meaningful variable and function names
- Add TypeScript types where applicable

## Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

## Recognition

All contributors are recognized in our repository and on the website. Your
contributions, no matter how small, are valued!

### Current Contributors

We're grateful to these contributors who have helped improve WebSocket.org:

- **[Matthew O'Riordan](https://github.com/mattheworiordan)** - Project Lead and
  Maintainer
- **[林博仁(Buo-ren, Lin)](https://github.com/brlin-tw)** - Documentation
  improvements
- **[Énio Carlos](https://github.com/eniocarboni)** - Code contributions
- **[Raj Gupta](https://github.com/rajgupta)** - Content contributions
- **[Sam Hobbs](https://github.com/samhobbs)** - Technical improvements

## Getting Help

If you need help, you can:

- Open an issue with your question
- Check existing documentation
- Reach out to the community

## License

By contributing, you agree that your contributions will be licensed under the
same license as the project.

## Questions?

Don't hesitate to open an issue if you have questions about contributing. We're
here to help!

---

Thank you for contributing to WebSocket.org! 🚀
