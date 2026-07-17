export type PickedFile = { file: File; relativePath: string };

function readEntry(entry: any, base: string): Promise<PickedFile[]> {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file((file: File) => {
        resolve([{ file, relativePath: base + file.name }]);
      }, () => resolve([]));
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const all: any[] = [];
      const readBatch = () => {
        reader.readEntries(async (entries: any[]) => {
          if (!entries.length) {
            const results = await Promise.all(all.map((e) => readEntry(e, base + entry.name + "/")));
            resolve(results.flat());
          } else {
            all.push(...entries);
            readBatch();
          }
        }, () => resolve([]));
      };
      readBatch();
    } else {
      resolve([]);
    }
  });
}

export async function readDataTransferItems(items: DataTransferItemList): Promise<PickedFile[]> {
  const entries: any[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const entry = (item as any).webkitGetAsEntry ? (item as any).webkitGetAsEntry() : null;
    if (entry) entries.push(entry);
    else {
      const file = item.getAsFile();
      if (file) entries.push({ isFile: true, file: (cb: any) => cb(file) });
    }
  }
  const results = await Promise.all(entries.map((e) => readEntry(e, "")));
  return results.flat();
}

export function fileListToPicked(files: FileList | File[]): PickedFile[] {
  return Array.from(files).map((file) => ({
    file,
    relativePath: (file as any).webkitRelativePath || file.name,
  }));
}
