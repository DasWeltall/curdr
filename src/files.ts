import { Platform } from "react-native";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
export async function saveText(
  name: string,
  content: string,
  mime = "text/plain",
) {
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const safe = name.replace(/[^\p{L}\p{N}._-]/gu, "_");
  const file = new File(Paths.cache, safe);
  file.write(content);
  if (await Sharing.isAvailableAsync())
    await Sharing.shareAsync(file.uri, { mimeType: mime });
  else throw Error("File sharing is not available on this device.");
}

export async function saveOutput(file: import("./data/types").OutputFile) {
  if (!file.base64) return saveText(file.name, file.content ?? "", file.mime);
  const binary = atob(file.base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(
      new Blob([bytes], { type: file.mime ?? "application/octet-stream" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const f = new File(Paths.cache, file.name.replace(/[^\p{L}\p{N}._-]/gu, "_"));
  f.write(bytes);
  if (await Sharing.isAvailableAsync())
    await Sharing.shareAsync(f.uri, { mimeType: file.mime });
  else throw Error("File sharing is not available on this device.");
}
