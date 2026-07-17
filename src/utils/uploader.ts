// Streaming-friendly uploader: the file is base64-encoded on the client in
// 3-byte-aligned chunks (so no padding appears mid-stream) and assembled into
// a Blob that already matches GitHub's Contents API JSON payload shape. The
// browser then PUTs that Blob straight through to the Worker, which pipes the
// request body directly to GitHub without ever buffering it — that's what
// keeps big uploads from tripping Cloudflare's CPU/memory limits (error 1102).

const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function encodeChunk(bytes: Uint8Array): string {
  let out = "";
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const has1 = i + 1 < len;
    const has2 = i + 2 < len;
    const b1 = has1 ? bytes[i + 1] : 0;
    const b2 = has2 ? bytes[i + 2] : 0;
    out += B64_CHARS[b0 >> 2];
    out += B64_CHARS[((b0 & 3) << 4) | (b1 >> 4)];
    out += has1 ? B64_CHARS[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    out += has2 ? B64_CHARS[b2 & 63] : "=";
  }
  return out;
}

export async function buildUploadBlob(
  file: File,
  opts: { message: string; branch: string; sha?: string },
  onEncodeProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<Blob> {
  const CHUNK = 3 * 1024 * 1024; // multiple of 3 bytes -> no mid-stream padding
  const parts: BlobPart[] = [`{"message":${JSON.stringify(opts.message)},"content":"`];
  let offset = 0;
  const total = file.size;
  if (total === 0) {
    onEncodeProgress?.(0, 0);
  }
  while (offset < total) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const end = Math.min(offset + CHUNK, total);
    const buf = await file.slice(offset, end).arrayBuffer();
    parts.push(encodeChunk(new Uint8Array(buf)));
    offset = end;
    onEncodeProgress?.(offset, total);
    // yield back to the event loop so the UI stays responsive
    await new Promise((r) => setTimeout(r, 0));
  }
  const suffix = opts.sha
    ? `","sha":"${opts.sha}","branch":"${opts.branch}"}`
    : `","branch":"${opts.branch}"}`;
  parts.push(suffix);
  return new Blob(parts, { type: "application/json" });
}

export function uploadBlob(
  url: string,
  blob: Blob,
  onProgress: (loaded: number, total: number) => void
): { promise: Promise<any>; xhr: XMLHttpRequest } {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<any>((resolve, reject) => {
    xhr.open("PUT", url);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve({});
        }
      } else {
        let msg = xhr.statusText || "上传失败";
        try {
          msg = JSON.parse(xhr.responseText).error || msg;
        } catch {}
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("网络错误，上传失败"));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    xhr.send(blob);
  });
  return { promise, xhr };
}
