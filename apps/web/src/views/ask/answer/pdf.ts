const MARGIN = 28;
const HEADER = 40;

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);

export async function downloadReportPdf(node: HTMLElement, title: string, workspace: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  const canvas = await html2canvas(node, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    ignoreElements: (el) => el.hasAttribute("data-pdf-hide"),
  });
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = pageW - MARGIN * 2;
  const scale = canvas.width / imgW;
  const sliceH = Math.floor((pageH - MARGIN * 2 - HEADER) * scale);
  const stamp = new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  const pages = Math.ceil(canvas.height / sliceH);

  for (let page = 0; page < pages; page += 1) {
    const y = page * sliceH;
    const h = Math.min(sliceH, canvas.height - y);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = h;
    slice.getContext("2d")?.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
    if (page > 0) pdf.addPage();
    pdf.setTextColor(27, 26, 46);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text(pdf.splitTextToSize(title, imgW - 80)[0] ?? "Mesh report", MARGIN, MARGIN + 12);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(120, 118, 140);
    pdf.text(`Mesh · ${workspace} · ${stamp}`, MARGIN, MARGIN + 26);
    pdf.text(`${page + 1} / ${pages}`, pageW - MARGIN, MARGIN + 12, { align: "right" });
    pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN, MARGIN + HEADER, imgW, h / scale);
  }
  pdf.save(`mesh-${slug(title) || "report"}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
