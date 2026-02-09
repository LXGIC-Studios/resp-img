#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, extname, join, dirname, relative } from "node:path";

// ── ANSI Colors ──────────────────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgGreen: "\x1b[42m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
};

// ── Arg parsing ──────────────────────────────────────────────────────────────
interface Args {
  input: string;
  output: string;
  widths: number[];
  formats: string[];
  quality: number;
  html: boolean;
  htmlFile: string | null;
  json: boolean;
  help: boolean;
  alt: string;
  prefix: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    input: "",
    output: "",
    widths: [320, 640, 1024, 1920],
    formats: ["webp", "original"],
    quality: 80,
    html: false,
    htmlFile: null,
    json: false,
    help: false,
    alt: "",
    prefix: "",
  };

  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--widths":
      case "-w":
        args.widths = (argv[++i] || "").split(",").map(Number).filter(n => n > 0).sort((a, b) => a - b);
        break;
      case "--output":
      case "-o":
        args.output = argv[++i] || "";
        break;
      case "--formats":
      case "-f":
        args.formats = (argv[++i] || "").split(",").map(s => s.trim().toLowerCase());
        break;
      case "--quality":
      case "-q":
        args.quality = parseInt(argv[++i] || "80");
        break;
      case "--html":
        args.html = true;
        break;
      case "--html-file":
        args.html = true;
        args.htmlFile = argv[++i] || null;
        break;
      case "--json":
        args.json = true;
        break;
      case "--help":
      case "-h":
        args.help = true;
        break;
      case "--alt":
        args.alt = argv[++i] || "";
        break;
      case "--prefix":
        args.prefix = argv[++i] || "";
        break;
      default:
        if (!arg.startsWith("-")) {
          positional.push(arg);
        }
    }
  }

  if (positional.length > 0) args.input = positional[0];
  if (positional.length > 1) args.output = positional[1];
  return args;
}

// ── Image processing ─────────────────────────────────────────────────────────
interface GeneratedImage {
  path: string;
  width: number;
  format: string;
  size: number;
}

async function processImage(args: Args): Promise<GeneratedImage[]> {
  // Dynamic import for sharp (the one allowed dependency)
  let sharp: typeof import("sharp");
  try {
    sharp = (await import("sharp")).default as unknown as typeof import("sharp");
  } catch {
    console.error(`${c.red}Error: 'sharp' package is required. Install it with: npm install sharp${c.reset}`);
    process.exit(1);
  }

  const inputName = basename(args.input, extname(args.input));
  const outputDir = args.output || join(dirname(args.input), `${inputName}-responsive`);

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const generated: GeneratedImage[] = [];
  const image = sharp(args.input);
  const metadata = await image.metadata();
  const originalWidth = metadata.width || 1920;
  const originalFormat = metadata.format || "jpeg";

  console.log(`${c.dim}Source: ${args.input} (${originalWidth}x${metadata.height}, ${originalFormat})${c.reset}`);
  console.log();

  for (const width of args.widths) {
    if (width > originalWidth) {
      console.log(`  ${c.yellow}Skip ${width}w${c.reset} ${c.dim}(larger than source ${originalWidth}w)${c.reset}`);
      continue;
    }

    for (const format of args.formats) {
      const actualFormat = format === "original" ? originalFormat : format;
      const ext = actualFormat === "jpeg" ? "jpg" : actualFormat;
      const outputName = `${args.prefix || inputName}-${width}w.${ext}`;
      const outputPath = join(outputDir, outputName);

      let pipeline = sharp(args.input).resize(width);

      switch (actualFormat) {
        case "webp":
          pipeline = pipeline.webp({ quality: args.quality });
          break;
        case "avif":
          pipeline = pipeline.avif({ quality: args.quality });
          break;
        case "png":
          pipeline = pipeline.png();
          break;
        case "jpeg":
        case "jpg":
          pipeline = pipeline.jpeg({ quality: args.quality });
          break;
        default:
          pipeline = pipeline.jpeg({ quality: args.quality });
      }

      const info = await pipeline.toFile(outputPath);

      generated.push({
        path: outputPath,
        width,
        format: actualFormat,
        size: info.size,
      });

      const sizeKb = (info.size / 1024).toFixed(1);
      console.log(`  ${c.green}+${c.reset} ${outputName} ${c.dim}(${width}x${info.height}, ${sizeKb}KB)${c.reset}`);
    }
  }

  return generated;
}

// ── HTML generation ──────────────────────────────────────────────────────────
function generatePictureElement(images: GeneratedImage[], alt: string, basePath: string): string {
  // Group by format
  const byFormat = new Map<string, GeneratedImage[]>();
  for (const img of images) {
    const group = byFormat.get(img.format) || [];
    group.push(img);
    byFormat.set(img.format, group);
  }

  const lines: string[] = ["<picture>"];

  // Modern formats first (avif, webp), then fallback
  const formatOrder = ["avif", "webp", "jpeg", "jpg", "png"];
  const sortedFormats = [...byFormat.keys()].sort((a, b) => {
    const ai = formatOrder.indexOf(a);
    const bi = formatOrder.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  for (const format of sortedFormats) {
    const formatImages = byFormat.get(format)!;
    const mimeType = format === "webp" ? "image/webp"
      : format === "avif" ? "image/avif"
      : format === "png" ? "image/png"
      : "image/jpeg";

    const srcset = formatImages
      .map(img => `${relative(basePath, img.path)} ${img.width}w`)
      .join(",\n         ");

    const sizes = formatImages
      .map((img, i) => {
        if (i === formatImages.length - 1) return `${img.width}px`;
        return `(max-width: ${img.width}px) ${img.width}px`;
      })
      .join(",\n        ");

    if (format === sortedFormats[sortedFormats.length - 1]) {
      // Last format becomes the img fallback
      lines.push(`  <img srcset="${srcset}"`);
      lines.push(`       sizes="${sizes}"`);
      lines.push(`       alt="${alt}"`);
      lines.push(`       loading="lazy"`);
      lines.push(`       decoding="async">`);
    } else {
      lines.push(`  <source type="${mimeType}"`);
      lines.push(`          srcset="${srcset}"`);
      lines.push(`          sizes="${sizes}">`);
    }
  }

  lines.push("</picture>");
  return lines.join("\n");
}

function generateSrcsetOnly(images: GeneratedImage[], alt: string, basePath: string): string {
  const srcset = images
    .map(img => `${relative(basePath, img.path)} ${img.width}w`)
    .join(",\n         ");

  const sizes = images
    .map((img, i) => {
      if (i === images.length - 1) return `${img.width}px`;
      return `(max-width: ${img.width}px) ${img.width}px`;
    })
    .join(",\n        ");

  return `<img srcset="${srcset}"\n     sizes="${sizes}"\n     alt="${alt}"\n     loading="lazy"\n     decoding="async">`;
}

// ── Help ─────────────────────────────────────────────────────────────────────
function showHelp(): void {
  console.log();
  console.log(`${c.bgCyan}${c.white}${c.bold}  RESP-IMG  ${c.reset} ${c.cyan}Generate responsive image sets${c.reset}`);
  console.log();
  console.log(`${c.bold}Usage:${c.reset}  resp-img <input> [options]`);
  console.log();
  console.log(`${c.bold}Options:${c.reset}`);
  console.log(`  ${c.green}--widths, -w${c.reset}         Comma-separated widths ${c.dim}(default: 320,640,1024,1920)${c.reset}`);
  console.log(`  ${c.green}--output, -o${c.reset}         Output directory ${c.dim}(default: <name>-responsive/)${c.reset}`);
  console.log(`  ${c.green}--formats, -f${c.reset}        Output formats ${c.dim}(default: webp,original)${c.reset}`);
  console.log(`  ${c.green}--quality, -q${c.reset}        Compression quality 1-100 ${c.dim}(default: 80)${c.reset}`);
  console.log(`  ${c.green}--html${c.reset}               Output HTML <picture> and <img srcset> markup`);
  console.log(`  ${c.green}--html-file <path>${c.reset}   Write HTML to file`);
  console.log(`  ${c.green}--alt <text>${c.reset}         Alt text for generated HTML`);
  console.log(`  ${c.green}--prefix <text>${c.reset}      Filename prefix ${c.dim}(default: source filename)${c.reset}`);
  console.log(`  ${c.green}--json${c.reset}               Output results as JSON`);
  console.log(`  ${c.green}--help, -h${c.reset}           Show this help`);
  console.log();
  console.log(`${c.bold}Supported formats:${c.reset} webp, avif, jpeg, png, original`);
  console.log();
  console.log(`${c.bold}Examples:${c.reset}`);
  console.log(`  ${c.dim}$ resp-img photo.jpg${c.reset}                            ${c.dim}# default widths${c.reset}`);
  console.log(`  ${c.dim}$ resp-img photo.jpg --widths 480,768,1200${c.reset}      ${c.dim}# custom widths${c.reset}`);
  console.log(`  ${c.dim}$ resp-img photo.jpg --html${c.reset}                     ${c.dim}# show HTML markup${c.reset}`);
  console.log(`  ${c.dim}$ resp-img photo.jpg --formats webp,avif,jpeg${c.reset}   ${c.dim}# multiple formats${c.reset}`);
  console.log(`  ${c.dim}$ resp-img photo.jpg --html-file markup.html${c.reset}    ${c.dim}# save HTML to file${c.reset}`);
  console.log();
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  if (!args.input) {
    console.error(`${c.red}Error: Input image is required. Use --help for usage.${c.reset}`);
    process.exit(1);
  }

  if (!existsSync(args.input)) {
    console.error(`${c.red}Error: File not found: ${args.input}${c.reset}`);
    process.exit(1);
  }

  console.log();
  console.log(`${c.bgCyan}${c.white}${c.bold}  RESP-IMG  ${c.reset} ${c.cyan}Responsive image generator${c.reset}`);
  console.log();

  const generated = await processImage(args);

  if (generated.length === 0) {
    console.log(`${c.yellow}No images were generated.${c.reset}`);
    process.exit(1);
  }

  const totalSize = generated.reduce((s, g) => s + g.size, 0);
  console.log();
  console.log(`${c.bgGreen}${c.white}${c.bold}  DONE  ${c.reset} Generated ${c.green}${generated.length}${c.reset} images (${(totalSize / 1024).toFixed(1)}KB total)`);

  // JSON output
  if (args.json) {
    console.log();
    console.log(JSON.stringify({
      input: args.input,
      widths: args.widths,
      formats: args.formats,
      quality: args.quality,
      images: generated.map(g => ({
        path: g.path,
        width: g.width,
        format: g.format,
        sizeBytes: g.size,
      })),
    }, null, 2));
  }

  // HTML output
  if (args.html) {
    const basePath = args.output || dirname(args.input);
    const alt = args.alt || basename(args.input, extname(args.input));

    console.log();
    console.log(`${c.bold}${c.yellow}<picture> element:${c.reset}`);
    console.log();
    const pictureHtml = generatePictureElement(generated, alt, basePath);
    console.log(pictureHtml);

    console.log();
    console.log(`${c.bold}${c.yellow}<img srcset> element:${c.reset}`);
    console.log();
    const srcsetHtml = generateSrcsetOnly(generated, alt, basePath);
    console.log(srcsetHtml);

    if (args.htmlFile) {
      const fullHtml = `<!-- Generated by resp-img -->\n\n<!-- <picture> element -->\n${pictureHtml}\n\n<!-- <img srcset> element -->\n${srcsetHtml}\n`;
      writeFileSync(args.htmlFile, fullHtml, "utf-8");
      console.log();
      console.log(`${c.green}HTML written to ${args.htmlFile}${c.reset}`);
    }
  }

  console.log();
}

main().catch(err => {
  console.error(`${c.red}Error: ${err.message}${c.reset}`);
  process.exit(1);
});
