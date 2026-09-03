/**
 * Turn an upload failure into something a technician can act on.
 *
 * Every upload path used to `catch { toast.error("Failed to upload image") }`,
 * so a 403 from a missing permission, a photo over the size cap, an nginx
 * 413 and a genuine server fault all looked identical. That is a large part
 * of why the same report kept coming back: nobody, including us, could tell
 * the causes apart from what the user saw.
 */
export function uploadErrorMessage(err: any): string {
  const status = err?.response?.status;
  const serverMessage = err?.response?.data?.error;

  // nginx rejects an oversized body itself and returns an HTML error page,
  // so there is no JSON message to read — only the status tells us.
  if (status === 413 && !serverMessage) {
    return "Those photos are too large to upload together. Try adding fewer at a time.";
  }
  if (status === 403) {
    return "You do not have permission to add photos to this ticket.";
  }
  if (status === 401) {
    return "Your session expired. Please sign in again.";
  }
  if (serverMessage) {
    return serverMessage;
  }
  if (err?.code === "ERR_NETWORK" || err?.message === "Network Error") {
    return "Upload failed — check your connection and try again.";
  }
  return "Failed to upload image";
}
