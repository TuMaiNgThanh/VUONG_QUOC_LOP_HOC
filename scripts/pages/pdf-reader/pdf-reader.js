function isLikelyPdf(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes(".pdf") || lower.includes("drive.google.com") || lower.includes("docs.google.com");
}

function toEmbeddablePdfUrl(url) {
  if (!url) return "";
  if (url.includes("drive.google.com/file/d/")) {
    const match = url.match(/\/file\/d\/([^/]+)/);
    if (match?.[1]) {
      return `https://drive.google.com/file/d/${match[1]}/preview`;
    }
  }
  return url;
}

function bootstrap() {
  const params = new URLSearchParams(window.location.search);
  const rawUrl = params.get("url") || "";
  const title = params.get("title") || "Tài liệu PDF";

  const pdfTitle = document.querySelector("#pdfTitle");
  const emptyState = document.querySelector("#emptyState");
  const pdfFrame = document.querySelector("#pdfFrame");
  const openNewTabBtn = document.querySelector("#openNewTabBtn");

  pdfTitle.textContent = title;

  if (!isLikelyPdf(rawUrl)) {
    emptyState.classList.remove("hidden");
    pdfFrame.style.display = "none";
    openNewTabBtn.style.display = "none";
    return;
  }

  const embeddedUrl = toEmbeddablePdfUrl(rawUrl);
  pdfFrame.src = embeddedUrl;
  openNewTabBtn.href = rawUrl;
}

bootstrap();
