# @lxgicstudios/resp-img

[![npm version](https://img.shields.io/npm/v/@lxgicstudios/resp-img.svg)](https://www.npmjs.com/package/@lxgicstudios/resp-img)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

Generate responsive image sets from a source image. Create multiple widths (320, 640, 1024, 1920), convert to modern formats (WebP, AVIF), and output ready-to-use HTML `<picture>` and `<img srcset>` markup.

## Install

```bash
npm install -g @lxgicstudios/resp-img
```

Or run directly:

```bash
npx @lxgicstudios/resp-img photo.jpg --html
```

## Usage

```bash
# Generate responsive images with default widths
resp-img photo.jpg

# Custom widths
resp-img photo.jpg --widths 480,768,1200,1600

# Output HTML markup
resp-img photo.jpg --html

# Save HTML to file
resp-img photo.jpg --html-file responsive.html

# Multiple formats (WebP + AVIF + original)
resp-img photo.jpg --formats webp,avif,jpeg

# Custom output directory
resp-img photo.jpg --output ./images/responsive

# Set quality
resp-img photo.jpg --quality 90

# JSON output for build scripts
resp-img photo.jpg --json
```

## Features

- Uses sharp for fast, high-quality image resizing
- Generates multiple widths from a single source image
- Supports WebP, AVIF, JPEG, and PNG output formats
- Outputs HTML `<picture>` and `<img srcset>` markup
- Skips widths larger than the source image
- Configurable compression quality
- Lazy loading and async decoding in generated HTML
- Custom filename prefixes
- JSON output for build tool integration
- Colorful terminal output with file size reporting

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--widths, -w` | Comma-separated output widths | `320,640,1024,1920` |
| `--output, -o` | Output directory | `<name>-responsive/` |
| `--formats, -f` | Output formats | `webp,original` |
| `--quality, -q` | Compression quality (1-100) | `80` |
| `--html` | Output HTML markup to terminal | `false` |
| `--html-file <path>` | Write HTML markup to file | - |
| `--alt <text>` | Alt text for HTML elements | filename |
| `--prefix <text>` | Output filename prefix | source filename |
| `--json` | Output results as JSON | `false` |
| `--help, -h` | Show help message | - |

## Dependencies

- [sharp](https://sharp.pixelplumbing.com/) - High-performance image processing

## License

MIT

---

**Built by [LXGIC Studios](https://lxgicstudios.com)**
