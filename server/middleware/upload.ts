import multer from "multer";
import path from "path";
import crypto from "crypto";

// Only these extensions are accepted. MIME type is also checked (see
// fileFilter below), but extensions are the ground-truth because MIME
// headers are client-supplied and trivially spoofed.
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, "uploads/");
  },
  filename: (_req, file, cb) => {
    // Never trust file.originalname — it can contain "../", null bytes, or
    // arbitrary path separators. Extract only the extension, validate it,
    // and use a random base name so there's no way to collide with or
    // overwrite existing files.
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return cb(new Error("Unsupported file extension"), "");
    }
    const random = crypto.randomBytes(16).toString("hex");
    cb(null, `${Date.now()}-${random}${ext}`);
  },
});

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return cb(new Error("Only image files (JPEG, PNG, WebP, GIF) are allowed"));
  }
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(new Error("Only image files (JPEG, PNG, WebP, GIF) are allowed"));
  }
  cb(null, true);
};

/**
 * Per-file ceiling, raised from 5MB.
 *
 * The real constraint is upstream: production nginx caps the WHOLE request
 * body at 10MB (verified against live — 9MB passes, 11MB returns 413), and
 * we cannot change that without SSH, which we do not have. So this is a
 * safety valve, not the limit that matters. The client downscales images
 * before upload (client/src/lib/compressImage.ts), which is what actually
 * keeps a technician's 6MB camera photo inside the envelope.
 *
 * Do not raise this past ~9MB: anything larger cannot reach the app at all,
 * it is rejected by nginx with an HTML 413 the client cannot parse.
 */
export const MAX_UPLOAD_MB = 8;
export const MAX_UPLOAD_FILES = 5;

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_UPLOAD_MB * 1024 * 1024,
    files: MAX_UPLOAD_FILES,
    fields: 20,
  },
});

export const uploadSingle = upload.single("image");
export const uploadMultiple = upload.array("images", 5);
