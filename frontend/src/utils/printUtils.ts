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
      margin: 0.5cm;
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

      window.addEventListener('load', function () {
        setTimeout(triggerPrint, 150);
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
