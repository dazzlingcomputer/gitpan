import { downloadZip } from "client-zip";

/**
 * Streams every file in `files` from the Worker and zips them client-side
 * (client-zip never buffers more than the current chunk), then triggers a
 * save-as download of the resulting archive.
 */
export async function downloadFolderAsZip(
  files: { path: string; relativePath: string }[],
  buildUrl: (path: string) => string,
  zipName: string,
  onProgress?: (done: number, total: number) => void
) {
  let done = 0;
  async function* gen() {
    for (const f of files) {
      const resp = await fetch(buildUrl(f.path), { credentials: "include" });
      if (!resp.ok) continue;
      yield { name: f.relativePath, input: resp };
      done += 1;
      onProgress?.(done, files.length);
    }
  }
  const blob = await downloadZip(gen()).blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = zipName.endsWith(".zip") ? zipName : `${zipName}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
}
