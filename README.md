# BookmarkMars Assistant

Development setup and build commands for the BookmarkMars browser extension.

## Prerequisites

Install the following before working on this project:

- Node.js
- Python
- Visual Studio (with C++ core features)
- Visual Studio Build Tools

## Setup

### Install build tools

```bash
npm install --global windows-build-tools
```

### Initialize the project

Installs dependencies and rebuilds `node-sass` for your environment. Run this once before using the commands below.

```bash
npm run init
```

## Commands

### Update dependencies

Updates dependency versions in `package.json` and installs them.

```bash
npm run update
```

### Release

Builds a minified copy of the source and outputs it to `__dist`.

```bash
npm run release
```

### SCSS

Compiles SCSS files into CSS.

```bash
npm run scss
```
