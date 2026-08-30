import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getHermesMemoryDirectory } from "../../../lib/hermes-runtime";

const PROJECT_ROOT = path.resolve(process.cwd());
const MEMORY_DIRECTORY = getHermesMemoryDirectory();

const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".next",
  ".git",
  ".vs",
  ".vscode",
]);

const IGNORED_EXTENSIONS = new Set([
  "exe",
  "dll",
  "bin",
  "db",
  "sqlite",
  "sqlite3",
  "lock",
  "woff",
  "woff2",
  "ttf",
  "otf",
  "ico",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "mp3",
  "wav",
  "mp4",
  "mov",
]);

const MAX_FILES = 500;
const MAX_PREVIEW_BYTES = 250_000;

type KnowledgeFile = {
  id: string;
  name: string;
  path: string;
  extension: string;
  type: string;
  size: number;
  modifiedAt: string;
};

function getFileType(extension: string) {
  const map: Record<string, string> = {
    ts: "TypeScript",
    tsx: "TypeScript",
    js: "JavaScript",
    jsx: "JavaScript",
    json: "JSON",
    md: "Markdown",
    css: "Stylesheet",
    html: "HTML",
    py: "Python",
    yml: "YAML",
    yaml: "YAML",
    txt: "Text",
  };

  return map[extension] || "File";
}

function isInsideProject(targetPath: string) {
  const relative = path.relative(
    PROJECT_ROOT,
    targetPath,
  );

  return (
    relative !== "" &&
    !relative.startsWith("..") &&
    !path.isAbsolute(relative)
  );
}

async function scanDirectory(
  directory: string,
  results: KnowledgeFile[],
) {
  if (results.length >= MAX_FILES) {
    return;
  }

  const entries = await fs.readdir(directory, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    if (results.length >= MAX_FILES) {
      return;
    }

    if (
      entry.isDirectory() &&
      IGNORED_DIRECTORIES.has(entry.name)
    ) {
      continue;
    }

    const fullPath = path.join(
      directory,
      entry.name,
    );

    if (entry.isDirectory()) {
      await scanDirectory(fullPath, results);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path
      .extname(entry.name)
      .replace(".", "")
      .toLowerCase();

    if (IGNORED_EXTENSIONS.has(extension)) {
      continue;
    }

    try {
      const stat = await fs.stat(fullPath);

      const relativePath = path.relative(
        PROJECT_ROOT,
        fullPath,
      );

      results.push({
        id: relativePath,
        name: entry.name,
        path: relativePath,
        extension,
        type: getFileType(extension),
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      });
    } catch {
      // Ignore inaccessible files.
    }
  }
}

export async function GET() {
  try {
    const memoryPath = path.join(
      MEMORY_DIRECTORY,
      "MEMORY.md",
    );
    const userPath = path.join(
      MEMORY_DIRECTORY,
      "USER.md",
    );

    async function readOptional(filePath: string) {
      try {
        const content = await fs.readFile(filePath, "utf8");
        return { exists: true, content };
      } catch (error) {
        const code =
          typeof error === "object" &&
          error !== null &&
          "code" in error
            ? String((error as { code?: unknown }).code)
            : "";

        if (code === "ENOENT") {
          return { exists: false, content: "" };
        }

        throw error;
      }
    }

    const [memory, user] = await Promise.all([
      readOptional(memoryPath),
      readOptional(userPath),
    ]);

    return NextResponse.json({
      memory,
      user,
      directory: MEMORY_DIRECTORY,
    });
  } catch (error) {
    console.error("Memory API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to access Hermes memory.",
      },
      { status: 500 },
    );
  }
}
