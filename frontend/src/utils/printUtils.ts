type PrintCorrectionListOptions = {
  title: string;
  html: string;
  language: 'nl' | 'en';
};

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function openCorrectionListPrintPreview(options: PrintCorrectionListOptions): void {
  const { title, html, language } = options;
  const printableHtml = String(html || '').trim();

  if (!printableHtml) {
    alert('Er is geen inhoud om af te drukken.');
    return;
  }

  const printWindow = window.open('about:blank', '_blank');

  if (!printWindow) {
    alert('Printvenster kon niet geopend worden. Sta pop-ups toe en probeer opnieuw.');
    return;
  }

  const docTitle = `${title} (${language.toUpperCase()})`;
  const documentHtml = `<!doctype html>
<html lang="${language}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(docTitle)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0cm;
    }

    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      background: #ffffff;
      color: #000000;
    }

    body {
      font-family: Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .sheet * {
      box-sizing: border-box;
    }

    .sheet ul,
    .sheet ol {
      margin: 0.75rem 0;
      padding-left: 1.5rem;
    }

    .sheet ul {
      list-style: disc;
    }

    .sheet ol {
      list-style: decimal;
    }

    .sheet li {
      margin: 0.2rem 0;
    }

    .sheet table {
      width: 100%;
      border-collapse: collapse;
      margin: 0.75rem 0;
      table-layout: auto;
    }

    .sheet th,
    .sheet td {
      border: 1px solid #000;
      padding: 0.35rem 0.45rem;
      vertical-align: top;
      word-break: break-word;
    }

    .sheet img {
      max-width: 100%;
      height: auto;
      page-break-inside: avoid;
    }

    .sheet figure {
      margin: 0.75rem 0;
    }

    .sheet figcaption {
      font-size: 0.9em;
      color: #333;
    }

    .sheet {
      width: 200mm;
      min-height: 287mm;
      margin: 0 auto;
      box-sizing: border-box;
      padding: 0;
    }

    @media screen {
      body {
        background: #eceff3;
      }

      .sheet {
        background: #fff;
      }
    }
  </style>
</head>
<body>
  <main class="sheet">${printableHtml}</main>
  <script>
    (function () {
      const triggerPrint = function () {
        try {
          window.focus();
          window.print();
        } catch (e) {
          console.error(e);
        }
      };

      const waitForImages = function () {
        const images = Array.from(document.images || []);

        if (!images.length) {
          return Promise.resolve();
        }

        return Promise.all(
          images.map(function (img) {
            if (img.complete) {
              return Promise.resolve();
            }

            return new Promise(function (resolve) {
              const done = function () {
                resolve();
              };

              img.addEventListener('load', done, { once: true });
              img.addEventListener('error', done, { once: true });
            });
          })
        );
      };

      window.addEventListener('load', function () {
        waitForImages().finally(function () {
          setTimeout(triggerPrint, 150);
        });
      });
    })();
  </script>
</body>
</html>`;

  try {
    printWindow.document.open();
    printWindow.document.write(documentHtml);
    printWindow.document.close();
  } catch {
    const blob = new Blob([documentHtml], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    printWindow.location.href = blobUrl;
    setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
  }
}
