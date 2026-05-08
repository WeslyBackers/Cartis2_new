import pool from '../config/database';

type QueryExecutor = {
  query: (text: string, params?: any[]) => Promise<any>;
};

type Baz2ArticleRow = {
  id: number;
  baz_number: string;
  year: number;
  book_number: number;
  article_number: number;
  is_temporary: boolean;
  title_nl: string | null;
  title_en: string | null;
  content_nl: string | null;
  content_en: string | null;
  task_id: number;
  task_number: string;
  task_title: string;
  affected_chart_codes?: string[];
};

type MsiTaskRow = {
  task_id: number;
  task_number: string;
  task_title: string;
  sort_year: number;
  baz_numbers: string;
};

function escapeHtml(value: string | null | undefined): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatEditionDate(date: Date, language: 'nl' | 'en'): string {
  const locale = language === 'nl' ? 'nl-BE' : 'en-GB';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function buildMsiSectionHtml(language: 'nl' | 'en', msiTasks: MsiTaskRow[]): string {
  const isDutch = language === 'nl';

  if (msiTasks.length === 0) {
    return `<p>${isDutch ? 'Geen MSI-actieve taken voor deze versie.' : 'No MSI-active tasks for this version.'}</p>`;
  }

  const grouped = new Map<number, MsiTaskRow[]>();
  for (const task of msiTasks) {
    const key = Number(task.sort_year) || 0;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)?.push(task);
  }

  const years = Array.from(grouped.keys()).sort((a, b) => b - a);

  return years
    .map((year) => {
      const tasks = grouped.get(year) || [];
      const taskItems = tasks
        .sort((a, b) => String(b.task_number || '').localeCompare(String(a.task_number || '')))
        .map((task) => {
          const bazText = String(task.baz_numbers || '').trim();
          return `
            <li style="margin-bottom: 0.45rem;">
              <strong>${escapeHtml(task.task_number)}</strong>
              <span style="color: #516173;"> - ${escapeHtml(task.task_title)}</span>
              ${bazText ? `<div style="font-size: 0.9rem; color: #516173;">BaZ: ${escapeHtml(bazText)}</div>` : ''}
            </li>
          `;
        })
        .join('');

      return `
        <section style="margin-bottom: 1rem;">
          <h3 style="margin: 0 0 0.45rem; font-size: 1rem; color: #16324f;">${escapeHtml(String(year))}</h3>
          <ul style="margin: 0; padding-left: 1.1rem;">${taskItems}</ul>
        </section>
      `;
    })
    .join('');
}

function buildArticlesSectionHtml(language: 'nl' | 'en', articles: Baz2ArticleRow[]): string {
  const isDutch = language === 'nl';
  const emptyArticles = isDutch ? 'Geen BaZ-artikelen beschikbaar.' : 'No BaZ articles available.';

  if (articles.length === 0) {
    return `<p>${emptyArticles}</p>`;
  }

  return articles
    .map((article) => {
      const title = isDutch ? article.title_nl : article.title_en;
      const content = isDutch ? article.content_nl : article.content_en;
      const affectedChartCodes = Array.isArray(article.affected_chart_codes)
        ? article.affected_chart_codes
            .map((code) => String(code || '').trim())
            .filter((code) => !!code)
        : [];
      const affectedChartsLine = affectedChartCodes.length > 0
        ? `<p style="margin: 0.65rem 0 0; color: #16324f;"><strong>${isDutch ? 'Kaarten' : 'Charts'}:</strong> ${escapeHtml(affectedChartCodes.join(', '))}</p>`
        : '';

      return `
        <section style="margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #d7dee8;">
          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: baseline; margin-bottom: 0.5rem;">
            <strong>${escapeHtml(article.baz_number)}</strong>
            <span style="color: #516173;">${escapeHtml(article.task_number)} - ${escapeHtml(article.task_title)}</span>
            <span style="color: #516173;">${escapeHtml(String(article.year || '-'))}</span>
          </div>
          ${title ? `<h3 style="margin: 0 0 0.5rem; font-size: 1rem; color: #16324f;">${escapeHtml(title)}</h3>` : ''}
          <div>${content || `<p>${emptyArticles}</p>`}</div>
          ${affectedChartsLine}
        </section>
      `;
    })
    .join('');
}

function buildBaz2PublicationHtml(
  language: 'nl' | 'en',
  productName: string,
  versionNumber: string,
  editionDate: string,
  msiTasks: MsiTaskRow[],
  articles: Baz2ArticleRow[]
): string {
  const isDutch = language === 'nl';
  const heading = isDutch ? 'BaZ-2 publicatie' : 'BaZ-2 publication';
  const publicationLabel = isDutch ? 'Publicatie' : 'Publication';
  const versionLabel = isDutch ? 'Versie' : 'Version';
  const editionDateLabel = isDutch ? 'Editie datum' : 'Edition Date';
  const msiLabel = isDutch
    ? 'Lijst van MSI-actieve items (gesorteerd op jaar)'
    : 'List of MSI-active items (sorted by year)';
  const articlesLabel = isDutch
    ? 'Volledige BaZ-artikelen gekoppeld aan deze versie'
    : 'Full BaZ articles linked to this version';

  return `
    <article style="font-family: Arial, sans-serif; line-height: 1.6; color: #14202b;">
      <header style="margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid #16324f;">
        <h1 style="margin: 0 0 0.5rem; color: #16324f;">${escapeHtml(heading)}</h1>
        <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem; color: #516173;">
          <tbody>
            <tr>
              <td style="width: 38%; padding: 0.2rem 0.35rem 0.2rem 0; font-weight: 700; color: #16324f;">${escapeHtml(publicationLabel)}</td>
              <td style="padding: 0.2rem 0;">${escapeHtml(productName)}</td>
            </tr>
            <tr>
              <td style="padding: 0.2rem 0.35rem 0.2rem 0; font-weight: 700; color: #16324f;">${escapeHtml(versionLabel)}</td>
              <td style="padding: 0.2rem 0;">${escapeHtml(versionNumber)}</td>
            </tr>
            <tr>
              <td style="padding: 0.2rem 0.35rem 0.2rem 0; font-weight: 700; color: #16324f;">${escapeHtml(editionDateLabel)}</td>
              <td style="padding: 0.2rem 0;">${escapeHtml(editionDate)}</td>
            </tr>
          </tbody>
        </table>
      </header>

      <section style="margin-bottom: 1.5rem;">
        <h2 style="margin: 0 0 0.75rem; font-size: 1.05rem; color: #16324f;">${escapeHtml(msiLabel)}</h2>
        ${buildMsiSectionHtml(language, msiTasks)}
      </section>

      <section>
        <h2 style="margin: 0 0 0.75rem; font-size: 1.05rem; color: #16324f;">${escapeHtml(articlesLabel)}</h2>
        ${buildArticlesSectionHtml(language, articles)}
      </section>
    </article>
  `;
}

export async function createBaz2PublicationPreview(
  productVersionId: number,
  db: QueryExecutor = pool
) {
  const versionResult = await db.query(
    `SELECT pv.id, pv.product_id, pv.version_number, pv.version_date, pv.publication_date, pv.created_at,
            p.code AS product_code, p.name AS product_name,
            pl.code AS production_line_code
     FROM product_versions pv
     JOIN products p ON p.id = pv.product_id
     JOIN production_lines pl ON pl.id = p.production_line_id
     WHERE pv.id = $1`,
    [productVersionId]
  );

  if (versionResult.rows.length === 0) {
    throw new Error('Product version not found');
  }

  const version = versionResult.rows[0];
  const normalizedCode = String(version.product_code || '').trim().toLowerCase();

  if (normalizedCode !== 'baz-2') {
    throw new Error('Product version is not BaZ-2');
  }

  const msiTasksResult = await db.query(
    `SELECT
       t.id AS task_id,
       t.task_number,
       t.title AS task_title,
       COALESCE(MAX(ta.year), EXTRACT(YEAR FROM COALESCE($3::date, $4::date, $5::timestamp))::int) AS sort_year,
       COALESCE(string_agg(DISTINCT ta.baz_number, ', '), '') AS baz_numbers
     FROM task_products tp
     JOIN tasks t ON t.id = tp.task_id
     LEFT JOIN task_articles ta ON ta.task_id = t.id
     WHERE tp.product_id = $1
       AND tp.product_version_id = $2
       AND t.msi_active = true
     GROUP BY t.id, t.task_number, t.title
     ORDER BY sort_year DESC, t.task_number DESC`,
    [version.product_id, productVersionId, version.publication_date, version.version_date, version.created_at]
  );

  const articlesResult = await db.query(
    `SELECT ta.id, ta.baz_number, ta.year, ta.book_number, ta.article_number, ta.is_temporary,
            ta.title_nl, ta.title_en, ta.content_nl, ta.content_en,
            t.id AS task_id, t.task_number, t.title AS task_title
     FROM task_products tp
     JOIN tasks t ON t.id = tp.task_id
     JOIN task_articles ta ON ta.task_id = t.id
     WHERE tp.product_id = $1
       AND tp.product_version_id = $2
     ORDER BY ta.year DESC, ta.book_number ASC, ta.article_number ASC`,
    [version.product_id, productVersionId]
  );

  const affectedChartsResult = await db.query(
    `SELECT ta.id AS article_id,
            COALESCE(
              array_agg(DISTINCT p.code ORDER BY p.code)
                FILTER (WHERE p.code IS NOT NULL AND BTRIM(p.code) <> ''),
              '{}'::text[]
            ) AS chart_codes
     FROM task_products tp
     JOIN tasks t ON t.id = tp.task_id
     JOIN task_articles ta ON ta.task_id = t.id
     JOIN task_products tp_chart ON tp_chart.task_id = t.id
     JOIN products p ON p.id = tp_chart.product_id
     WHERE tp.product_id = $1
       AND tp.product_version_id = $2
       AND p.type = 'chart'
     GROUP BY ta.id`,
    [version.product_id, productVersionId]
  );

  const affectedChartsByArticleId = new Map<number, string[]>();
  for (const row of affectedChartsResult.rows as Array<{ article_id: number; chart_codes: string[] | string | null }>) {
    const articleId = Number(row.article_id);
    if (!Number.isFinite(articleId)) {
      continue;
    }

    let chartCodes: string[] = [];
    if (Array.isArray(row.chart_codes)) {
      chartCodes = row.chart_codes
        .map((code) => String(code || '').trim())
        .filter((code) => !!code);
    } else if (typeof row.chart_codes === 'string') {
      chartCodes = row.chart_codes
        .replace(/^[{]/, '')
        .replace(/[}]$/, '')
        .split(',')
        .map((code) => code.replace(/^"|"$/g, '').trim())
        .filter((code) => !!code);
    }

    affectedChartsByArticleId.set(articleId, chartCodes);
  }

  const msiTasks: MsiTaskRow[] = msiTasksResult.rows.map((row: MsiTaskRow) => ({
    ...row,
    task_number: String(row.task_number || '').trim(),
    task_title: String(row.task_title || '').trim(),
    baz_numbers: String(row.baz_numbers || '').trim(),
    sort_year: Number(row.sort_year) || 0,
  }));

  const articles: Baz2ArticleRow[] = articlesResult.rows
    .map((row: Baz2ArticleRow) => ({
      ...row,
      baz_number: String(row.baz_number || '').trim(),
      task_number: String(row.task_number || '').trim(),
      task_title: String(row.task_title || '').trim(),
      year: Number(row.year) || 0,
      affected_chart_codes: affectedChartsByArticleId.get(Number(row.id)) || [],
    }))
    .filter((row: Baz2ArticleRow) => !!row.baz_number);

  const editionDateNl = formatEditionDate(new Date(), 'nl');
  const editionDateEn = formatEditionDate(new Date(), 'en');

  return {
    productVersionId,
    productId: Number(version.product_id),
    productCode: version.product_code,
    productName: version.product_name,
    versionNumber: version.version_number,
    msiTasks,
    articles,
    nl: {
      html: buildBaz2PublicationHtml(
        'nl',
        String(version.product_name || ''),
        String(version.version_number || ''),
        editionDateNl,
        msiTasks,
        articles
      ),
    },
    en: {
      html: buildBaz2PublicationHtml(
        'en',
        String(version.product_name || ''),
        String(version.version_number || ''),
        editionDateEn,
        msiTasks,
        articles
      ),
    },
  };
}
