/** Browser-side text extraction for uploaded files. */
export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist");
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) pages.push(`--- Page ${pageNumber} ---\n${text}`);
    }
    const joined = pages.join("\n\n");
    if (!joined.trim()) {
      throw new Error(
        "This PDF looks like a scan with no selectable text. Please paste the text instead.",
      );
    }
    return joined;
  }

  if (
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".csv") ||
    file.type.startsWith("text/")
  ) {
    return await file.text();
  }

  throw new Error("Please upload a PDF or a text file, or paste the text directly.");
}
