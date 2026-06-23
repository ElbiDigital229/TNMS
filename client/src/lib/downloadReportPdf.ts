import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export interface DownloadReportPdfOptions {
  filename: string;
  /** PDF page orientation. Defaults to portrait. */
  orientation?: "portrait" | "landscape";
  /** Title rendered at the top of each page. */
  title?: string;
  /** Optional subtitle (e.g. filter summary). */
  subtitle?: string;
}

/**
 * Render a DOM element as a paginated PDF and trigger a download.
 *
 * Captures the element with html2canvas, then slices the bitmap across
 * A4 pages so long reports flow naturally. Each page gets a header with
 * the title/subtitle and a footer with page number + timestamp.
 */
export async function downloadReportPdf(
  element: HTMLElement,
  options: DownloadReportPdfOptions,
): Promise<void> {
  const orientation = options.orientation ?? "portrait";

  // Wait for any in-flight CSS transitions to settle. The horizontal bar
  // charts use a 500ms width animation; if we snapshot mid-animation
  // (common when the user clicks "Download PDF" immediately after "Run
  // Report"), html2canvas captures the bars at width: 0 and the PDF shows
  // the legend without the bars. Two animation frames + a 700ms timeout
  // covers the transition plus a small buffer.
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => setTimeout(resolve, 700));

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    windowWidth: element.scrollWidth,
    onclone: (doc) => {
      // (1) html2canvas measures glyph widths slightly differently from the
      // browser. At small font sizes with `truncate` (overflow:hidden +
      // white-space:nowrap + text-overflow:ellipsis), the gap is enough
      // that labels which fit in the live DOM get clipped mid-character
      // in the canvas — turning "Electronics" into "Flectronics",
      // "Glass" into "Glaee", "Equipment" into "Fauinment".
      // Relax the constraints in the cloned DOM only so labels expand
      // to their natural width during capture.
      doc.querySelectorAll<HTMLElement>(".truncate").forEach((el) => {
        el.style.overflow = "visible";
        el.style.textOverflow = "clip";
        el.style.whiteSpace = "nowrap";
        el.style.maxWidth = "none";
        el.style.width = "max-content";
      });

      // (2) Elements explicitly marked as UI-only (filter chips,
      // pagination controls, "Click to filter" hints, etc.) are hidden
      // from the PDF capture. The page itself remains interactive — only
      // the cloned DOM gets these collapsed.
      doc.querySelectorAll<HTMLElement>("[data-pdf-hide]").forEach((el) => {
        el.style.display = "none";
      });
    },
  });

  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 24;
  const contentWidth = pageWidth - margin * 2;
  const headerHeight = options.title ? (options.subtitle ? 38 : 24) : 0;
  const footerHeight = 18;
  const usableHeight = pageHeight - margin * 2 - headerHeight - footerHeight;

  const ratio = contentWidth / canvas.width;

  const drawHeader = (page: number, totalPages: number) => {
    if (options.title) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.setTextColor(17, 24, 39);
      pdf.text(options.title, margin, margin + 12);
    }
    if (options.subtitle) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(107, 114, 128);
      pdf.text(options.subtitle, margin, margin + 28);
    }
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(156, 163, 175);
    pdf.text(
      `Page ${page} of ${totalPages}    ·    ${new Date().toLocaleString()}`,
      pageWidth / 2,
      pageHeight - margin / 2,
      { align: "center" },
    );
  };

  // Slice the canvas into page-sized chunks.
  const sliceHeightPx = usableHeight / ratio;
  const totalPages = Math.max(1, Math.ceil(canvas.height / sliceHeightPx));

  const sliceCanvas = document.createElement("canvas");
  const ctx = sliceCanvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D canvas context");
  sliceCanvas.width = canvas.width;

  for (let i = 0; i < totalPages; i++) {
    const yOffsetPx = i * sliceHeightPx;
    const remainingPx = canvas.height - yOffsetPx;
    const thisSlicePx = Math.min(sliceHeightPx, remainingPx);
    sliceCanvas.height = thisSlicePx;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    ctx.drawImage(
      canvas,
      0, yOffsetPx, canvas.width, thisSlicePx,
      0, 0, canvas.width, thisSlicePx,
    );
    const imgData = sliceCanvas.toDataURL("image/jpeg", 0.92);
    if (i > 0) pdf.addPage();
    drawHeader(i + 1, totalPages);
    pdf.addImage(
      imgData,
      "JPEG",
      margin,
      margin + headerHeight,
      contentWidth,
      thisSlicePx * ratio,
    );
  }

  pdf.save(options.filename);
}
