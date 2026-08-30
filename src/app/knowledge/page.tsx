"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BookOpen,
  Database,
  FileText,
  FolderOpen,
  Globe,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Upload,
  X,
} from "lucide-react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import Sidebar from "../../components/sidebar";
import Topbar from "../../components/topbar";

type KnowledgeFile = {
  id: string;
  name: string;
  path: string;
  extension: string;
  type: string;
  size: number;
  modifiedAt: string;
};

type KnowledgeResponse = {
  root: string;
  files: KnowledgeFile[];
  totalFiles: number;
  totalSize: number;
  sourceCount: number;
  typeCount: number;
};

type PreviewData = {
  path: string;
  name: string;
  type: string;
  size: number;
  content: string;
};

type Filter =
  | "All"
  | "Documents"
  | "Research"
  | "Local";

const MAX_ANALYSIS_CHARS = 24000;
const ANALYSIS_HEAD_CHARS = 16000;
const ANALYSIS_TAIL_CHARS = 8000;

export default function KnowledgePage() {
  const [data, setData] =
    useState<KnowledgeResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [filter, setFilter] =
    useState<Filter>("All");

  const [
    selectedFile,
    setSelectedFile,
  ] =
    useState<KnowledgeFile | null>(
      null,
    );

  const [preview, setPreview] =
    useState<PreviewData | null>(
      null,
    );

  const [
    previewLoading,
    setPreviewLoading,
  ] =
    useState(false);

  const [
    previewError,
    setPreviewError,
  ] = useState("");

  const [
    askQuestion,
    setAskQuestion,
  ] = useState(
    "Analyze this file and explain what it does.",
  );

  const [
    askResponse,
    setAskResponse,
  ] = useState("");

  const [asking, setAsking] =
    useState(false);

  const [askError, setAskError] =
    useState("");

  const [
    analysisWasTrimmed,
    setAnalysisWasTrimmed,
  ] = useState(false);

  const [
    uploading,
    setUploading,
  ] = useState(false);

  const [
    uploadMessage,
    setUploadMessage,
  ] = useState("");

  const [
    uploadError,
    setUploadError,
  ] = useState("");

  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  useEffect(() => {
    void loadKnowledge();
  }, []);

  async function loadKnowledge() {
    setLoading(true);
    setError("");

    try {
      const response =
        await fetch(
          "/api/knowledge",
          {
            cache: "no-store",
          },
        );

      const text =
        await response.text();

      let result:
        | KnowledgeResponse
        | {
            error?: string;
          };

      try {
        result =
          JSON.parse(text);
      } catch {
        throw new Error(
          text ||
            `Knowledge API returned HTTP ${response.status}.`,
        );
      }

      if (!response.ok) {
        throw new Error(
          "error" in result &&
            result.error
            ? result.error
            : "Unable to load knowledge.",
        );
      }

      setData(
        result as KnowledgeResponse,
      );
    } catch (err) {
      console.error(
        "Knowledge page error:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load the project knowledge index.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function openFile(
    file: KnowledgeFile,
  ) {
    setSelectedFile(file);
    setPreview(null);
    setPreviewError("");
    setAskResponse("");
    setAskError("");
    setAnalysisWasTrimmed(false);
    setAskQuestion(
      "Analyze this file and explain what it does.",
    );
    setPreviewLoading(true);

    try {
      const response =
        await fetch(
          `/api/knowledge?path=${encodeURIComponent(
            file.path,
          )}`,
          {
            cache:
              "no-store",
          },
        );

      const text =
        await response.text();

      let result:
        | PreviewData
        | {
            error?: string;
          };

      try {
        result =
          JSON.parse(text);
      } catch {
        throw new Error(
          text ||
            `Preview API returned HTTP ${response.status}.`,
        );
      }

      if (!response.ok) {
        throw new Error(
          "error" in result &&
            result.error
            ? result.error
            : "Unable to preview file.",
        );
      }

      setPreview(
        result as PreviewData,
      );
    } catch (err) {
      console.error(
        "File preview error:",
        err,
      );

      setPreviewError(
        err instanceof Error
          ? err.message
          : "This file cannot be previewed.",
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    setSelectedFile(null);
    setPreview(null);
    setAskResponse("");
    setAskError("");
    setAsking(false);
    setAnalysisWasTrimmed(false);
  }

  function prepareAnalysisContent(
    content: string,
  ) {
    if (
      content.length <=
      MAX_ANALYSIS_CHARS
    ) {
      return {
        content,
        trimmed: false,
      };
    }

    const head =
      content.slice(
        0,
        ANALYSIS_HEAD_CHARS,
      );

    const tail =
      content.slice(
        -ANALYSIS_TAIL_CHARS,
      );

    return {
      content:
        head +
        "\n\n" +
        "/* =====================================================\n" +
        "   MIDDLE OF FILE OMITTED FOR CONTEXT SAFETY\n" +
        "   The file is larger than the analysis limit.\n" +
        "   The beginning and end are included below.\n" +
        "   ===================================================== */\n\n" +
        tail,
      trimmed: true,
    };
  }

  async function askAriAboutFile() {
    if (
      !preview ||
      !askQuestion.trim()
    ) {
      return;
    }

    setAsking(true);
    setAskResponse("");
    setAskError("");

    const prepared =
      prepareAnalysisContent(
        preview.content,
      );

    setAnalysisWasTrimmed(
      prepared.trimmed,
    );

    try {
      const prompt = `
The user selected this project file.

FILE: ${preview.path}
TYPE: ${preview.type}
ORIGINAL SIZE: ${preview.content.length.toLocaleString()} characters

FILE CONTENT:
--------------------
${prepared.content}
--------------------

USER QUESTION:
${askQuestion}

Answer the user's question specifically about this file.
Use the file content as the primary source.
Be concise but technically useful.
Use Markdown formatting when helpful.

${
  prepared.trimmed
    ? `
IMPORTANT:
The file was too large to include in full.
The middle section was omitted.
Do not pretend you inspected the omitted section.
State clearly that the analysis was based on the beginning and end of the file.
`
    : ""
}
`;

      const response =
        await fetch(
          "/api/ari",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              messages: [
                {
                  role: "user",
                  content: prompt,
                },
              ],
            }),
          },
        );

      if (!response.ok) {
        throw new Error(
          await response.text(),
        );
      }

      if (!response.body) {
        throw new Error(
          "ARI returned no response body.",
        );
      }

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder();

      let buffer = "";
      let finalText = "";

      while (true) {
        const { done, value } =
          await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(
          value,
          {
            stream: true,
          },
        );

        const lines =
          buffer.split("\n");

        buffer =
          lines.pop() || "";

        for (const rawLine of lines) {
          const line =
            rawLine.trim();

          if (
            !line.startsWith(
              "data:",
            )
          ) {
            continue;
          }

          const payload =
            line.slice(5).trim();

          if (
            !payload ||
            payload ===
              "[DONE]"
          ) {
            continue;
          }

          try {
            const event =
              JSON.parse(
                payload,
              );

            const content =
              event?.choices?.[0]
                ?.delta?.content;

            if (
              typeof content ===
              "string"
            ) {
              finalText +=
                content;

              setAskResponse(
                finalText,
              );
            }
          } catch {
            // Ignore non-JSON SSE lines.
          }
        }
      }
    } catch (err) {
      console.error(
        "Ask ARI error:",
        err,
      );

      setAskError(
        err instanceof Error
          ? err.message
          : "ARI could not analyze this file.",
      );
    } finally {
      setAsking(false);
    }
  }

  async function importFiles(
    files: File[],
  ) {
    if (
      files.length === 0
    ) {
      return;
    }

    setUploading(true);
    setUploadMessage("");
    setUploadError("");

    try {
      const formData =
        new FormData();

      files.forEach(
        (file, index) => {
          formData.append(
            "files",
            file,
          );

          const relativePath =
            (
              file as File & {
                webkitRelativePath?: string;
              }
            ).webkitRelativePath ||
            file.name;

          formData.append(
            `relativePath_${index}`,
            relativePath,
          );
        },
      );

      const response =
        await fetch(
          "/api/knowledge",
          {
            method: "POST",
            body: formData,
          },
        );

      const text =
        await response.text();

      let result: {
        success?: boolean;
        uploadedCount?: number;
        skippedCount?: number;
        totalBytes?: number;
        source?: string;
        error?: string;
      };

      try {
        result =
          JSON.parse(text);
      } catch {
        throw new Error(
          text ||
            `Import API returned HTTP ${response.status}.`,
        );
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            `Import failed with HTTP ${response.status}.`,
        );
      }

      setUploadMessage(
        `${result.uploadedCount ?? 0} files imported from ${
          result.source ||
          "source"
        }.`,
      );

      await loadKnowledge();

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          "";
      }
    } catch (err) {
      console.error(
        "Source import error:",
        err,
      );

      setUploadError(
        err instanceof Error
          ? err.message
          : "Unable to import the selected source.",
      );
    } finally {
      setUploading(false);
    }
  }

  const filteredFiles =
    useMemo(() => {
      if (!data) {
        return [];
      }

      const query =
        search
          .trim()
          .toLowerCase();

      return data.files
        .filter((file) => {
          if (
            filter ===
            "Documents"
          ) {
            return [
              "Markdown",
              "JSON",
              "Text",
            ].includes(
              file.type,
            );
          }

          if (
            filter ===
            "Research"
          ) {
            return (
              file.type ===
              "Markdown"
            );
          }

          return true;
        })
        .filter((file) => {
          if (!query) {
            return true;
          }

          return (
            file.name
              .toLowerCase()
              .includes(query) ||
            file.path
              .toLowerCase()
              .includes(query) ||
            file.type
              .toLowerCase()
              .includes(query)
          );
        })
        .slice(0, 100);
    }, [
      data,
      filter,
      search,
    ]);

  return (
    <main className="flex h-screen overflow-hidden bg-[#07031f] text-white">

      <Sidebar />

      <section className="flex min-w-0 flex-1 flex-col">

        <Topbar />

        <div className="flex-1 overflow-y-auto">

          <div className="mx-auto w-full max-w-[1280px] px-8 py-8">

            {/* HEADER */}

            <div className="flex items-end justify-between">

              <div>

                <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#00e5ff]">
                  Intelligence
                </p>

                <h1 className="mt-2 text-3xl font-bold">
                  Knowledge Base
                </h1>

                <p className="mt-2 text-sm text-[#6f688f]">
                  Manage the information ARI can access.
                </p>

              </div>

              <div className="flex items-center gap-3">

                {/* FILE UPLOAD */}

                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/[0.1] bg-[#0d0730] px-4 py-2.5 text-sm font-semibold text-[#a9a3c4] transition hover:border-[#00e5ff]/30 hover:text-white">

                  {uploading ? (
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <Upload size={16} />
                  )}

                  Upload File

                  <input
                    type="file"
                    className="hidden"
                    accept=".txt,.md,.markdown,.json,.csv,.xml,.yaml,.yml,.ts,.tsx,.js,.jsx,.py,.css,.html"
                    disabled={uploading}
                    onChange={(
                      event,
                    ) => {
                      const file =
                        event.target.files?.[0];

                      if (file) {
                        void importFiles(
                          [
                            file,
                          ],
                        );
                      }
                    }}
                  />

                </label>

                {/* FOLDER SOURCE */}

                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#fff000]/60 bg-[#fff000]/[0.06] px-5 py-2.5 text-sm font-semibold text-[#fff000] transition hover:bg-[#fff000]/[0.12]">

                  {uploading ? (
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <Plus size={16} />
                  )}

                  Add Source

                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    disabled={uploading}
                    {...({
                      webkitdirectory:
                        "",
                      directory:
                        "",
                    } as React.InputHTMLAttributes<HTMLInputElement>)}
                    onChange={(
                      event,
                    ) => {
                      const files =
                        Array.from(
                          event.target.files ||
                            [],
                        );

                      if (
                        files.length > 0
                      ) {
                        void importFiles(
                          files,
                        );
                      }
                    }}
                  />

                </label>

              </div>

            </div>

            {/* STATUS */}

            {(uploadMessage ||
              uploadError) && (
              <div
                className={`mt-5 rounded-xl border px-4 py-3 text-xs ${
                  uploadError
                    ? "border-[#ff69b7]/20 bg-[#ff69b7]/[0.04] text-[#ff9ad2]"
                    : "border-[#00e5b0]/20 bg-[#00e5b0]/[0.04] text-[#00e5b0]"
                }`}
              >
                {uploadError ||
                  uploadMessage}
              </div>
            )}

            {/* OVERVIEW */}

            <div className="mt-7 grid grid-cols-4 gap-4">

              <KnowledgeCard
                icon={FileText}
                label="Documents"
                value={
                  loading
                    ? "—"
                    : String(
                        data?.totalFiles ??
                          0,
                      )
                }
                detail={
                  loading
                    ? "Loading..."
                    : "Project files scanned"
                }
                accent="yellow"
              />

              <KnowledgeCard
                icon={Globe}
                label="Sources"
                value={
                  loading
                    ? "—"
                    : String(
                        data?.sourceCount ??
                          0,
                      )
                }
                detail="Local + imported"
                accent="cyan"
              />

              <KnowledgeCard
                icon={Database}
                label="Storage"
                value={
                  loading
                    ? "—"
                    : formatBytes(
                        data?.totalSize ??
                          0,
                      )
                }
                detail="Indexed project data"
                accent="teal"
              />

              <KnowledgeCard
                icon={BookOpen}
                label="Indexed"
                value={
                  loading
                    ? "—"
                    : data
                    ? "LIVE"
                    : "—"
                }
                detail={
                  data
                    ? `${data.typeCount} file types`
                    : "Waiting"
                }
                accent="yellow"
              />

            </div>

            {/* SEARCH */}

            <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/[0.1] bg-[#0d0730] p-4">

              <div className="flex items-center gap-2">

                {(
                  [
                    "All",
                    "Documents",
                    "Research",
                    "Local",
                  ] as Filter[]
                ).map(
                  (item) => (
                    <button
                      key={item}
                      onClick={() =>
                        setFilter(
                          item,
                        )
                      }
                      className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                        filter ===
                        item
                          ? "bg-[#fff000]/[0.08] text-[#fff000]"
                          : "text-[#777099] hover:bg-white/[0.04] hover:text-white"
                      }`}
                    >
                      {item}
                    </button>
                  ),
                )}

              </div>

              <div className="flex h-9 w-[280px] items-center gap-2 rounded-lg border border-white/[0.08] bg-[#07031f] px-3">

                <Search
                  size={15}
                  className="text-[#6f688f]"
                />

                <input
                  value={search}
                  onChange={(
                    event,
                  ) =>
                    setSearch(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Search knowledge..."
                  className="flex-1 bg-transparent text-xs text-white outline-none placeholder:text-[#4f496d]"
                />

              </div>

            </div>

            {/* PROJECT ROOT */}

            {data && (
              <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/[0.1] bg-[#0d0730] px-5 py-4">

                <FolderOpen
                  size={17}
                  className="text-[#00e5ff]"
                />

                <div className="min-w-0">

                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6f688f]">
                    Indexed project
                  </p>

                  <p className="mt-1 truncate font-mono text-xs text-[#a9a3c4]">
                    {data.root}
                  </p>

                </div>

              </div>
            )}

            {/* TABLE */}

            <div className="mt-5 overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0d0730]">

              <div className="grid grid-cols-[1fr_130px_110px_100px_50px] border-b border-white/[0.08] px-5 py-4 text-[10px] font-semibold uppercase tracking-wider text-[#6f688f]">

                <span>
                  Knowledge Item
                </span>

                <span>
                  Type
                </span>

                <span>
                  Source
                </span>

                <span>
                  Updated
                </span>

                <span />

              </div>

              {loading ? (

                <div className="flex min-h-[240px] items-center justify-center">

                  <div className="text-center">

                    <Loader2
                      size={24}
                      className="mx-auto animate-spin text-[#00e5ff]"
                    />

                    <p className="mt-3 text-sm text-[#6f688f]">
                      Scanning project files...
                    </p>

                  </div>

                </div>

              ) : filteredFiles.length === 0 ? (

                <div className="flex min-h-[240px] items-center justify-center">

                  <div className="text-center">

                    <FileText
                      size={26}
                      className="mx-auto text-[#4f496d]"
                    />

                    <p className="mt-3 text-sm font-semibold">
                      No matching files
                    </p>

                    <p className="mt-2 text-xs text-[#6f688f]">
                      Try another search.
                    </p>

                  </div>

                </div>

              ) : (

                filteredFiles.map(
                  (file) => (
                    <button
                      key={file.id}
                      onClick={() =>
                        openFile(
                          file,
                        )
                      }
                      className="grid w-full grid-cols-[1fr_130px_110px_100px_50px] items-center border-b border-white/[0.06] px-5 py-5 text-left last:border-0 transition hover:bg-white/[0.02]"
                    >

                      <div className="flex min-w-0 items-center gap-4">

                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#00e5ff]/15 bg-[#07031f]">

                          <FileText
                            size={18}
                            className="text-[#00e5ff]"
                          />

                        </div>

                        <div className="min-w-0">

                          <p className="truncate text-sm font-semibold text-white">
                            {file.name}
                          </p>

                          <p className="mt-1 truncate text-xs text-[#6f688f]">
                            {file.path}
                          </p>

                        </div>

                      </div>

                      <span className="text-xs text-[#a9a3c4]">
                        {file.type}
                      </span>

                      <span className="flex items-center gap-2 text-xs text-[#a9a3c4]">

                        <FolderOpen
                          size={13}
                          className="text-[#fff000]"
                        />

                        {file.path.startsWith(
                          "knowledge",
                        )
                          ? "Imported"
                          : "Local"}

                      </span>

                      <span className="text-xs text-[#777099]">
                        {formatRelativeTime(
                          file.modifiedAt,
                        )}
                      </span>

                      <span className="flex h-8 w-8 items-center justify-center text-[#6f688f]">

                        <MoreHorizontal
                          size={16}
                        />

                      </span>

                    </button>
                  ),
                )

              )}

            </div>

          </div>

        </div>

      </section>

      {/* FILE WORKSPACE */}

      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">

          <div className="flex h-[90vh] w-full max-w-[1150px] flex-col overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0a0527] shadow-2xl">

            <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">

              <div className="min-w-0">

                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#00e5ff]">
                  File Workspace
                </p>

                <h2 className="mt-1 truncate text-lg font-bold">
                  {selectedFile.path}
                </h2>

              </div>

              <button
                onClick={closePreview}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#777099] hover:bg-white/[0.05] hover:text-white"
              >
                <X size={18} />
              </button>

            </div>

            <div className="grid min-h-0 flex-1 grid-cols-2">

              <div className="min-h-0 overflow-auto border-r border-white/[0.08] p-5">

                {previewLoading ? (

                  <div className="flex h-full items-center justify-center">

                    <Loader2
                      size={26}
                      className="animate-spin text-[#00e5ff]"
                    />

                  </div>

                ) : previewError ? (

                  <div className="flex h-full items-center justify-center text-center">

                    <div>

                      <FileText
                        size={28}
                        className="mx-auto text-[#ff69b7]"
                      />

                      <p className="mt-3 text-sm font-semibold">
                        Preview unavailable
                      </p>

                      <p className="mt-2 text-xs text-[#6f688f]">
                        {previewError}
                      </p>

                    </div>

                  </div>

                ) : preview ? (

                  <pre className="whitespace-pre-wrap break-words rounded-xl border border-white/[0.08] bg-[#05021a] p-5 font-mono text-xs leading-6 text-[#d9d5e8]">
                    {preview.content}
                  </pre>

                ) : null}

              </div>

              <div className="flex min-h-0 flex-col p-5">

                <div>

                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#fff000]">
                    ARI Analysis
                  </p>

                  <h3 className="mt-2 text-lg font-bold">
                    Ask ARI about this file
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-[#6f688f]">
                    ARI will analyze the selected file directly.
                  </p>

                </div>

                {analysisWasTrimmed && (
                  <div className="mt-4 rounded-xl border border-[#fff000]/20 bg-[#fff000]/[0.04] px-4 py-3">

                    <p className="text-xs font-semibold text-[#fff000]">
                      Large file
                    </p>

                    <p className="mt-1 text-[11px] leading-5 text-[#a9a3c4]">
                      The middle of this file was omitted from the AI prompt to keep analysis within a safe context size.
                    </p>

                  </div>
                )}

                <div className="mt-5 min-h-0 flex-1 overflow-auto rounded-xl border border-white/[0.08] bg-[#05021a] p-4">

                  {asking &&
                  !askResponse ? (

                    <div className="flex items-center gap-3 text-sm text-[#a9a3c4]">

                      <Loader2
                        size={17}
                        className="animate-spin text-[#fff000]"
                      />

                      ARI is analyzing the file...

                    </div>

                  ) : askError ? (

                    <div>

                      <p className="text-sm font-semibold text-[#ff69b7]">
                        ARI request failed
                      </p>

                      <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[#a9a3c4]">
                        {askError}
                      </p>

                    </div>

                  ) : askResponse ? (

                    <div className="text-sm leading-6 text-[#d9d5e8]">

                      <ReactMarkdown
                        remarkPlugins={[
                          remarkGfm,
                        ]}
                        components={{
                          h1: ({
                            children,
                          }) => (
                            <h1 className="mb-4 mt-6 text-xl font-bold text-white">
                              {children}
                            </h1>
                          ),

                          h2: ({
                            children,
                          }) => (
                            <h2 className="mb-3 mt-5 text-lg font-bold text-white">
                              {children}
                            </h2>
                          ),

                          h3: ({
                            children,
                          }) => (
                            <h3 className="mb-2 mt-4 text-base font-bold text-white">
                              {children}
                            </h3>
                          ),

                          p: ({
                            children,
                          }) => (
                            <p className="mb-3 text-sm leading-6 text-[#d9d5e8]">
                              {children}
                            </p>
                          ),

                          ul: ({
                            children,
                          }) => (
                            <ul className="mb-4 ml-5 list-disc space-y-1">
                              {children}
                            </ul>
                          ),

                          ol: ({
                            children,
                          }) => (
                            <ol className="mb-4 ml-5 list-decimal space-y-1">
                              {children}
                            </ol>
                          ),

                          li: ({
                            children,
                          }) => (
                            <li className="text-sm text-[#d9d5e8]">
                              {children}
                            </li>
                          ),

                          blockquote: ({
                            children,
                          }) => (
                            <blockquote className="my-4 border-l-2 border-[#00e5ff]/50 pl-4 text-[#aaa4c2]">
                              {children}
                            </blockquote>
                          ),

                          pre: ({
                            children,
                          }) => (
                            <pre className="mb-4 overflow-x-auto">
                              {children}
                            </pre>
                          ),

                          code: ({
                            className,
                            children,
                          }) => {
                            const isBlock =
                              className?.includes(
                                "language-",
                              );

                            if (
                              isBlock
                            ) {
                              return (
                                <code
                                  className={`block overflow-x-auto rounded-xl border border-white/[0.08] bg-[#05021a] p-4 font-mono text-xs leading-6 text-[#d9d5e8] ${
                                    className ??
                                    ""
                                  }`}
                                >
                                  {children}
                                </code>
                              );
                            }

                            return (
                              <code className="rounded-md border border-white/[0.08] bg-[#05021a] px-1.5 py-0.5 font-mono text-xs text-[#fff000]">
                                {children}
                              </code>
                            );
                          },

                          strong: ({
                            children,
                          }) => (
                            <strong className="font-bold text-white">
                              {children}
                            </strong>
                          ),

                          a: ({
                            href,
                            children,
                          }) => (
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#00e5ff] underline underline-offset-2"
                            >
                              {children}
                            </a>
                          ),
                        }}
                      >
                        {askResponse}
                      </ReactMarkdown>

                    </div>

                  ) : (

                    <div className="flex h-full items-center justify-center text-center">

                      <div>

                        <FileText
                          size={25}
                          className="mx-auto text-[#4f496d]"
                        />

                        <p className="mt-3 text-sm font-semibold">
                          Ready for analysis
                        </p>

                        <p className="mt-2 text-xs text-[#6f688f]">
                          Ask ARI a question about the selected file.
                        </p>

                      </div>

                    </div>

                  )}

                </div>

                <div className="mt-4">

                  <textarea
                    value={askQuestion}
                    onChange={(
                      event,
                    ) =>
                      setAskQuestion(
                        event.target.value,
                      )
                    }
                    disabled={
                      asking ||
                      !preview
                    }
                    rows={3}
                    placeholder="Ask ARI something about this file..."
                    className="w-full resize-none rounded-xl border border-white/[0.1] bg-[#07031f] px-4 py-3 text-sm text-white outline-none placeholder:text-[#4f496d] focus:border-[#fff000]/40 disabled:opacity-50"
                  />

                  <button
                    onClick={() =>
                      void askAriAboutFile()
                    }
                    disabled={
                      asking ||
                      !preview ||
                      !askQuestion.trim()
                    }
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#fff000]/50 bg-[#fff000]/[0.06] px-5 py-3 text-sm font-semibold text-[#fff000] transition hover:bg-[#fff000]/[0.12] disabled:cursor-not-allowed disabled:opacity-40"
                  >

                    {asking ? (
                      <>
                        <Loader2
                          size={16}
                          className="animate-spin"
                        />

                        ARI is thinking...
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        Ask ARI
                      </>
                    )}

                  </button>

                </div>

              </div>

            </div>

          </div>

        </div>
      )}

    </main>
  );
}

function KnowledgeCard({
  icon: Icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
  accent:
    | "yellow"
    | "cyan"
    | "teal";
}) {
  const color = {
    yellow: "#fff000",
    cyan: "#00e5ff",
    teal: "#00e5b0",
  }[accent];

  return (
    <div className="rounded-2xl border border-white/[0.1] bg-[#0d0730] p-5">

      <div className="flex items-center justify-between">

        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6f688f]">
          {label}
        </p>

        <Icon
          size={17}
          style={{ color }}
        />

      </div>

      <p className="mt-5 text-3xl font-bold text-white">
        {value}
      </p>

      <p className="mt-2 text-[11px] text-[#6f688f]">
        {detail}
      </p>

    </div>
  );
}

function formatBytes(
  bytes: number,
) {
  if (bytes === 0) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
  ];

  const exponent =
    Math.floor(
      Math.log(bytes) /
        Math.log(1024),
    );

  const index =
    Math.min(
      exponent,
      units.length - 1,
    );

  const value =
    bytes /
    Math.pow(
      1024,
      index,
    );

  return `${value.toFixed(
    index === 0 ? 0 : 1,
  )} ${units[index]}`;
}

function formatRelativeTime(
  value: string,
) {
  const timestamp =
    new Date(
      value,
    ).getTime();

  if (
    Number.isNaN(
      timestamp,
    )
  ) {
    return "Unknown";
  }

  const difference =
    Date.now() -
    timestamp;

  const minutes =
    Math.floor(
      difference / 60000,
    );

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours =
    Math.floor(
      minutes / 60,
    );

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days =
    Math.floor(
      hours / 24,
    );

  if (days === 1) {
    return "Yesterday";
  }

  return `${days}d ago`;
}