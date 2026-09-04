/**
 * Downscale and re-encode an image in the browser before upload.
 *
 * Why this exists: production nginx caps the whole request body at 10MB
 * (verified against live — 9MB passes, 11MB returns 413), we have no SSH to
 * raise it, and the deploy pipeline does not touch nginx. Meanwhile an
 * Android camera photo is routinely 3-6MB and 8-15MB on high-megapixel
 * phones, so two photos from a technician's phone could not fit in one
 * request no matter what the server-side limit said.
 *
 * Shrinking client-side fixes it at the source: a 1920px JPEG at q0.8 lands
 * around 200-500KB, so five of them fit comfortably, and technicians on
 * mobile data upload a fraction of the bytes.
 */

const MAX_DIMENSION = 1920;
const QUALITY = 0.8;

/** Files below this are already small enough to leave alone. */
const SKIP_BELOW_BYTES = 512 * 1024;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode image"));
    };
    img.src = url;
  });
}

/**
 * Returns a downscaled JPEG, or the original file unchanged if it is already
 * small, is not an image, or anything at all goes wrong. Never throws — a
 * failed compression must not cost the user their photo.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= SKIP_BELOW_BYTES) {
    return file;
  }

  try {
    const img = await loadImage(file);

    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
    const width = Math.round(img.width * scale);
    const height = Math.round(img.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );
    if (!blob || blob.size >= file.size) {
      // Re-encoding made it bigger (already-optimised JPEGs, small PNGs).
      return file;
    }

    // The server validates uploads on the file EXTENSION, so the .jpg here is
    // load-bearing — the re-encoded blob is always JPEG regardless of input.
    const name = file.name.replace(/\.[^./\\]+$/, "") || "photo";
    return new File([blob], `${name}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

/** compressImage over a list, preserving order. */
export async function compressImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map(compressImage));
}
