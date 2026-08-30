import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const PROJECT_ROOT = path.resolve(process.cwd());
const KNOWLEDGE_DIR = path.join(
  PROJECT_ROOT,
  "knowledge",
);
const SOURCES_DIR = path.join(
  KNOWLEDGE_DIR,
  "sources",
);

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

const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "json",
  "csv",
  "xml",
  "yaml",
  "yml",
  "ts",
  "tsx",
  "js",
  "jsx",
  "py",
  "css",
  "html",
]);

const MAX_FILES = 1000;
const MAX_PREVIEW_BYTES = 250_000;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

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
    mjs: "JavaScript",
    json: "JSON",
    md: "Markdown",
    markdown: "Markdown",
    css: "Stylesheet",
    html: "HTML",
    py: "Python",
    yml: "YAML",
    yaml: "YAML",
    txt: "Text",
    csv: "CSV",
    xml: "XML",
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

function sanitizeSegment(value: string) {
  return value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .trim();
}

function normalizeRelativePath(value: string) {
  const normalized = value.replace(
    /\\/g,
    "/",
  );

  const parts = normalized
    .split("/")
    .filter(Boolean)
    .filter(
      (part) =>
        part !== "." &&
        part !== "..",
    )
    .map(sanitizeSegment)
    .filter(Boolean);

  return parts.join(path.sep);
}

function isAllowedExtension(
  filename: string,
) {
  const extension = path
    .extname(filename)
    .replace(".", "")
    .toLowerCase();

  return (
    extension.length > 0 &&
    ALLOWED_UPLOAD_EXTENSIONS.has(
      extension,
    )
  );
}

async function scanDirectory(
  directory: string,
  results: KnowledgeFile[],
) {
  if (results.length >= MAX_FILES) {
    return;
  }

  let entries;

  try {
    entries = await fs.readdir(
      directory,
      {
        withFileTypes: true,
      },
    );
  } catch {
    return;
  }

  for (const entry of entries) {
    if (results.length >= MAX_FILES) {
      return;
    }

    if (
      entry.isDirectory() &&
      IGNORED_DIRECTORIES.has(
        entry.name,
      )
    ) {
      continue;
    }

    const fullPath = path.join(
      directory,
      entry.name,
    );

    if (entry.isDirectory()) {
      await scanDirectory(
        fullPath,
        results,
      );
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path
      .extname(entry.name)
      .replace(".", "")
      .toLowerCase();

    if (
      IGNORED_EXTENSIONS.has(
        extension,
      )
    ) {
      continue;
    }

    try {
      const stat =
        await fs.stat(fullPath);

      const relativePath =
        path.relative(
          PROJECT_ROOT,
          fullPath,
        );

      results.push({
        id: relativePath,
        name: entry.name,
        path: relativePath,
        extension,
        type: getFileType(
          extension,
        ),
        size: stat.size,
        modifiedAt:
          stat.mtime.toISOString(),
      });
    } catch {
      // Ignore inaccessible files.
    }
  }
}

export async function GET(
  request: Request,
) {
  try {
    const url =
      new URL(request.url);

    const requestedPath =
      url.searchParams.get(
        "path",
      );

    if (requestedPath) {
      const normalizedPath =
        requestedPath.replace(
          /[\\/]+/g,
          path.sep,
        );

      const absolutePath =
        path.resolve(
          PROJECT_ROOT,
          normalizedPath,
        );

      if (
        !isInsideProject(
          absolutePath,
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid file path.",
          },
          {
            status: 400,
          },
        );
      }

      const stat =
        await fs.stat(
          absolutePath,
        );

      if (!stat.isFile()) {
        return NextResponse.json(
          {
            error:
              "Requested path is not a file.",
          },
          {
            status: 400,
          },
        );
      }

      if (
        stat.size >
        MAX_PREVIEW_BYTES
      ) {
        return NextResponse.json(
          {
            error:
              "File is too large to preview.",
          },
          {
            status: 413,
          },
        );
      }

      const extension =
        path
          .extname(
            absolutePath,
          )
          .replace(
            ".",
            "",
          )
          .toLowerCase();

      if (
        IGNORED_EXTENSIONS.has(
          extension,
        )
      ) {
        return NextResponse.json(
          {
            error:
              "This file type is not previewable.",
          },
          {
            status: 415,
          },
        );
      }

      const content =
        await fs.readFile(
          absolutePath,
          "utf8",
        );

      return NextResponse.json({
        path: path.relative(
          PROJECT_ROOT,
          absolutePath,
        ),
        name:
          path.basename(
            absolutePath,
          ),
        type: getFileType(
          extension,
        ),
        size: stat.size,
        content,
      });
    }

    const files: KnowledgeFile[] =
      [];

    await scanDirectory(
      PROJECT_ROOT,
      files,
    );

    files.sort(
      (a, b) =>
        new Date(
          b.modifiedAt,
        ).getTime() -
        new Date(
          a.modifiedAt,
        ).getTime(),
    );

    const totalSize =
      files.reduce(
        (sum, file) =>
          sum + file.size,
        0,
      );

    const extensions =
      new Set(
        files
          .map(
            (file) =>
              file.extension,
          )
          .filter(Boolean),
      );

    return NextResponse.json({
      root: PROJECT_ROOT,
      files,
      totalFiles:
        files.length,
      totalSize,
      sourceCount:
        countSources(files),
      typeCount:
        extensions.size,
    });
  } catch (error) {
    console.error(
      "Knowledge GET error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to access project knowledge.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(
  request: Request,
) {
  try {
    const formData =
      await request.formData();

    const files =
      formData.getAll("files");

    if (
      files.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "No files were provided.",
        },
        {
          status: 400,
        },
      );
    }

    let uploadedCount = 0;
    let skippedCount = 0;
    let totalBytes = 0;
    let sourceName = "";

    for (
      let index = 0;
      index < files.length;
      index += 1
    ) {
      const value = files[index];

      if (!(value instanceof File)) {
        skippedCount += 1;
        continue;
      }

      const relativePathValue =
        formData.get(
          `relativePath_${index}`,
        );

      const fallbackName =
        sanitizeSegment(
          value.name,
        );

      const relativePath =
        typeof relativePathValue ===
        "string" &&
        relativePathValue.trim()
          ? normalizeRelativePath(
              relativePathValue,
            )
          : fallbackName;

      if (!relativePath) {
        skippedCount += 1;
        continue;
      }

      if (
        value.size === 0
      ) {
        skippedCount += 1;
        continue;
      }

      if (
        value.size >
        MAX_UPLOAD_BYTES
      ) {
        skippedCount += 1;
        continue;
      }

      if (
        !isAllowedExtension(
          value.name,
        )
      ) {
        skippedCount += 1;
        continue;
      }

      const parts =
        relativePath.split(
          path.sep,
        );

      if (
        parts.length < 2
      ) {
        sourceName =
          sourceName ||
          path.basename(
            value.name,
            path.extname(
              value.name,
            ),
          );
      } else {
        sourceName =
          sourceName ||
          sanitizeSegment(
            parts[0],
          );
      }

      const finalRelativePath =
        path.join(
          "knowledge",
          "sources",
          sourceName ||
            "imported-source",
          ...parts.slice(
            sourceName
              ? 1
              : 0,
          ),
        );

      const destination =
        path.resolve(
          PROJECT_ROOT,
          finalRelativePath,
        );

      if (
        !isInsideProject(
          destination,
        )
      ) {
        skippedCount += 1;
        continue;
      }

      await fs.mkdir(
        path.dirname(
          destination,
        ),
        {
          recursive: true,
        },
      );

      const bytes =
        await value.arrayBuffer();

      await fs.writeFile(
        destination,
        Buffer.from(
          bytes,
        ),
      );

      uploadedCount += 1;
      totalBytes +=
        value.size;
    }

    if (
      uploadedCount === 0
    ) {
      return NextResponse.json(
        {
          error:
            "No supported files were imported.",
          uploadedCount: 0,
          skippedCount,
        },
        {
          status: 400,
        },
      );
    }

    return NextResponse.json({
      success: true,
      uploadedCount,
      skippedCount,
      totalBytes,
      source:
        sourceName ||
        "Imported source",
    });
  } catch (error) {
    console.error(
      "Knowledge POST error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to import the selected source.",
      },
      {
        status: 500,
      },
    );
  }
}

function countSources(
  files: KnowledgeFile[],
) {
  const sources =
    new Set<string>();

  for (const file of files) {
    const parts =
      file.path.split(
        /[\\/]+/,
      );

    if (
      parts[0] ===
        "knowledge" &&
      parts[1] === "sources" &&
      parts[2]
    ) {
      sources.add(
        `source:${parts[2]}`,
      );
    } else {
      sources.add(
        "source:local-project",
      );
    }
  }

  return sources.size;
}