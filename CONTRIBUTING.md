# Contributing to Autocorrect for Logseq

Thank you for your interest in contributing! This document provides guidelines for contributing to this project.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/autocorrect-for-logseq.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature-name`

## Development

### Building

```bash
npm run build        # Build once
npm run watch        # Watch mode (auto-rebuild)
npm run build-dict   # Rebuild dictionary from codespell
```

### Testing

1. Build the plugin: `npm run build`
2. Load it in Logseq (Developer Mode → Load unpacked plugin → select `dist/` folder)
3. Test your changes in Logseq

### Code Style

- Use TypeScript
- Follow existing code style
- Add comments for complex logic
- Keep functions focused and testable

## Areas for Contribution

### Dictionary Improvements

- Add more conservative filtering rules
- Improve UK English word detection
- Add domain-specific dictionaries (technical terms, etc.)

### Features

- Implement "expanded" mode
- Add user feedback mechanism (accept/reject corrections)
- Improve cursor position handling
- Add undo/redo support

### Bug Fixes

- Test across different Logseq versions
- Fix edge cases in word boundary detection
- Improve performance for large dictionaries

## Submitting Changes

1. Ensure your code builds: `npm run build`
2. Test your changes thoroughly
3. Update documentation if needed
4. Commit with clear messages
5. Push to your fork
6. Create a pull request

## License

By contributing, you agree that your contributions will be licensed under the MIT License (for code) and CC BY-SA 3.0 (for dictionary modifications).

## Questions?

Open an issue for discussion or questions about contributing.

