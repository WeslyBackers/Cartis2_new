import pool from '../config/database';
import { getOrCreateInProgressProductVersion } from './productVersion.service';

type QueryExecutor = {
  query: (text: string, params?: any[]) => Promise<any>;
};

type ProductMeta = {
  product_code?: string | null;
  product_name?: string | null;
  production_line_code?: string | null;
};

type ArticleRow = {
  id: number;
  baz_number: string;
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
};

const CORRECTION_LIST_PREFIX = 'VL-';

type CorrectionListTarget = {
  code: string;
  name: string;
  description: string;
  sourceChartCodes: string[];
};

function normalizeValue(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function escapeHtml(value: string | null | undefined): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseSourceChartCode(productCode: string | null | undefined): string {
  const value = String(productCode || '').trim();
  return value.startsWith(CORRECTION_LIST_PREFIX)
    ? value.slice(CORRECTION_LIST_PREFIX.length)
    : value;
}

function getGroupedDeelkaartBase(chartCode: string | null | undefined): string | null {
  const trimmed = String(chartCode || '').trim();
  const match = trimmed.match(/^Deelkaart\s+(104|105|107)\/\d+$/i);
  return match ? match[1] : null;
}

function sortArticles(a: ArticleRow, b: ArticleRow): number {
  if (a.book_number !== b.book_number) return a.book_number - b.book_number;
  if (a.article_number !== b.article_number) return a.article_number - b.article_number;
  return a.baz_number.localeCompare(b.baz_number);
}

function formatEditionDate(date: Date, language: 'nl' | 'en'): string {
  const locale = language === 'nl' ? 'nl-BE' : 'en-GB';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function buildCorrectionListCode(chartCode: string): string {
  const groupedBase = getGroupedDeelkaartBase(chartCode);
  return `${CORRECTION_LIST_PREFIX}${groupedBase || String(chartCode || '').trim()}`;
}

export function buildCorrectionListName(chartCode: string, chartName: string): string {
  const groupedBase = getGroupedDeelkaartBase(chartCode);
  if (groupedBase) {
    return `Verbeterlijst ${groupedBase}`;
  }

  const trimmedChartName = String(chartName || '').trim();
  const trimmedChartCode = String(chartCode || '').trim();
  return trimmedChartName
    ? `Verbeterlijst ${trimmedChartCode} - ${trimmedChartName}`
    : `Verbeterlijst ${trimmedChartCode}`;
}

function buildCorrectionListDescription(chartCode: string, chartName: string): string {
  const groupedBase = getGroupedDeelkaartBase(chartCode);
  if (groupedBase) {
    return `Verbeterlijst voor Deelkaart ${groupedBase}`;
  }

  return `Verbeterlijst voor ${String(chartCode || '').trim()} - ${String(chartName || '').trim()}`;
}

async function getCorrectionListTarget(chartProductId: number, db: QueryExecutor): Promise<CorrectionListTarget | null> {
  const chartProduct = await getChartProductMeta(chartProductId, db);

  if (!chartProduct) {
    return null;
  }

  const groupedBase = getGroupedDeelkaartBase(chartProduct.code);

  if (!groupedBase) {
    return {
      code: buildCorrectionListCode(chartProduct.code),
      name: buildCorrectionListName(chartProduct.code, chartProduct.name),
      description: buildCorrectionListDescription(chartProduct.code, chartProduct.name),
      sourceChartCodes: [String(chartProduct.code || '').trim()],
    };
  }

  const groupedChartsResult = await db.query(
    `SELECT code
     FROM products p
     JOIN production_lines pl ON pl.id = p.production_line_id
     WHERE pl.code = 'ZK'
       AND p.type = 'chart'
       AND p.code ~ $1
     ORDER BY p.code`,
    [`^Deelkaart ${groupedBase}/[0-9]+$`]
  );

  return {
    code: `${CORRECTION_LIST_PREFIX}${groupedBase}`,
    name: `Verbeterlijst ${groupedBase}`,
    description: `Verbeterlijst voor Deelkaart ${groupedBase}`,
    sourceChartCodes: groupedChartsResult.rows.map((row: { code: string }) => String(row.code || '').trim()),
  };
}

export function isPublCorrectionListProduct(product: ProductMeta): boolean {
  const productionLineCode = String(product.production_line_code || '').trim().toUpperCase();
  const code = String(product.product_code || '').trim();
  const normalizedCode = normalizeValue(product.product_code);
  const normalizedName = normalizeValue(product.product_name);

  return productionLineCode === 'PUBL' && (
    code.startsWith(CORRECTION_LIST_PREFIX) ||
    normalizedCode.includes('verbeterlijst') ||
    normalizedName.includes('verbeterlijst') ||
    normalizedName.includes('listofcorrections')
  );
}

async function getPublProductionLineId(db: QueryExecutor): Promise<number> {
  const result = await db.query(
    "SELECT id FROM production_lines WHERE code = 'PUBL' LIMIT 1"
  );

  if (result.rows.length === 0) {
    throw new Error('PUBL production line not found');
  }

  return Number(result.rows[0].id);
}

async function getChartProductMeta(chartProductId: number, db: QueryExecutor) {
  const result = await db.query(
    `SELECT p.id, p.code, p.name, p.type, p.description, p.geometry, p.is_active,
            pl.code AS production_line_code
     FROM products p
     JOIN production_lines pl ON pl.id = p.production_line_id
     WHERE p.id = $1`,
    [chartProductId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  const productionLineCode = String(row.production_line_code || '').trim().toUpperCase();
  const productType = String(row.type || '').trim().toLowerCase();

  if (productionLineCode !== 'ZK' || productType !== 'chart') {
    return null;
  }

  return row;
}

export async function ensureCorrectionListProductForChartProduct(
  chartProductId: number,
  db: QueryExecutor = pool
): Promise<number | null> {
  const chartProduct = await getChartProductMeta(chartProductId, db);
  const target = await getCorrectionListTarget(chartProductId, db);

  if (!chartProduct || !target) {
    return null;
  }

  const publProductionLineId = await getPublProductionLineId(db);

  const result = await db.query(
    `INSERT INTO products
      (production_line_id, code, name, type, description, geometry, is_active)
     VALUES ($1, $2, $3, 'publication', $4, $5, $6)
     ON CONFLICT (code) DO UPDATE
     SET production_line_id = EXCLUDED.production_line_id,
         name = EXCLUDED.name,
         type = EXCLUDED.type,
         description = EXCLUDED.description,
         geometry = EXCLUDED.geometry,
         is_active = EXCLUDED.is_active,
         updated_at = CURRENT_TIMESTAMP
     RETURNING id`,
    [
      publProductionLineId,
      target.code,
      target.name,
      target.description,
      chartProduct.geometry || null,
      chartProduct.is_active !== false,
    ]
  );

  return Number(result.rows[0].id);
}

export async function ensureCorrectionListTaskLink(
  taskId: number,
  chartProductId: number,
  opts: { userId?: number | null; status?: string | null; notes?: string | null },
  db: QueryExecutor = pool
): Promise<number | null> {
  const correctionListProductId = await ensureCorrectionListProductForChartProduct(chartProductId, db);

  if (!correctionListProductId) {
    return null;
  }

  const productVersionId = await getOrCreateInProgressProductVersion(
    correctionListProductId,
    { userId: opts.userId ?? null },
    db
  );

  await db.query(
    `INSERT INTO task_products
      (task_id, product_id, product_version_id, status, notes, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (task_id, product_id) DO NOTHING`,
    [taskId, correctionListProductId, productVersionId, opts.status || 'hoog_te_verwerken', opts.notes || null]
  );

  const publProductionLineId = await getPublProductionLineId(db);

  await db.query(
    `INSERT INTO task_production_line_status (task_id, production_line_id, status, wait_for_zk)
     VALUES ($1, $2, 'under_construction', false)
     ON CONFLICT (task_id, production_line_id) DO NOTHING`,
    [taskId, publProductionLineId]
  );

  return correctionListProductId;
}

function buildCorrectionListHtml(
  language: 'nl' | 'en',
  productName: string,
  sourceChartCode: string,
  sourceChartName: string,
  versionNumber: string,
  latestBazNumber: string,
  editionDate: string,
  activeBazNumbers: string[],
  articles: ArticleRow[]
): string {
  const isDutch = language === 'nl';
  const heading = isDutch ? 'Verbeterlijst' : 'List of Corrections';
  const activeLabel = isDutch
    ? 'Actieve BaZ-nrs. die nog niet in een eerdere versie van deze papieren kaart zijn gepubliceerd'
    : 'Active NtM numbers that have not yet been published in an earlier version of this paper chart';
  const articlesLabel = isDutch ? 'Overzicht van BaZ-artikelen' : 'Overview of NtM articles';
  const emptyActive = isDutch ? 'Geen actieve BaZ-nrs.' : 'No active NtM numbers.';
  const emptyArticles = isDutch ? 'Geen BaZ-artikelen beschikbaar.' : 'No NtM articles available.';

  const activeListHtml = activeBazNumbers.length > 0
    ? `<ol>${activeBazNumbers.map((bazNumber) => `<li>${escapeHtml(bazNumber)}</li>`).join('')}</ol>`
    : `<p>${emptyActive}</p>`;

  const articleHtml = articles.length > 0
    ? articles.map((article) => {
        const title = isDutch ? article.title_nl : article.title_en;
        const content = isDutch ? article.content_nl : article.content_en;
        return `
          <section style="margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #d7dee8;">
            <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: baseline; margin-bottom: 0.5rem;">
              <strong>${escapeHtml(article.baz_number)}</strong>
              <span style="color: #516173;">${escapeHtml(article.task_number)} - ${escapeHtml(article.task_title)}</span>
            </div>
            ${title ? `<h3 style="margin: 0 0 0.5rem; font-size: 1rem; color: #16324f;">${escapeHtml(title)}</h3>` : ''}
            <div>${content || `<p>${emptyArticles}</p>`}</div>
          </section>
        `;
      }).join('')
    : `<p>${emptyArticles}</p>`;

  const chartLabel = isDutch ? 'Papieren kaart' : 'Paper chart';
  const versionLabel = isDutch ? 'Versie' : 'Version';
  const updatedUpToLabel = isDutch ? 'bijgewerkt tot' : 'Updated up to and including NMs';
  const editionDateLabel = isDutch ? 'Editie datum' : 'Edition Date';

  return `
    <article style="font-family: Arial, sans-serif; line-height: 1.6; color: #14202b;">
      <header style="margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid #16324f;">
        <h1 style="margin: 0 0 0.5rem; color: #16324f;">${escapeHtml(heading)}</h1>
        <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem; color: #516173;">
          <tbody>
            <tr>
              <td style="width: 38%; padding: 0.2rem 0.35rem 0.2rem 0; font-weight: 700; color: #16324f;">${escapeHtml(heading)}</td>
              <td style="padding: 0.2rem 0;">${escapeHtml(productName)}</td>
            </tr>
            <tr>
              <td style="padding: 0.2rem 0.35rem 0.2rem 0; font-weight: 700; color: #16324f;">${escapeHtml(chartLabel)}</td>
              <td style="padding: 0.2rem 0;">${escapeHtml(sourceChartCode)} - ${escapeHtml(sourceChartName)}</td>
            </tr>
            <tr>
              <td style="padding: 0.2rem 0.35rem 0.2rem 0; font-weight: 700; color: #16324f;">${escapeHtml(versionLabel)}</td>
              <td style="padding: 0.2rem 0;">${escapeHtml(versionNumber)}</td>
            </tr>
            <tr>
              <td style="padding: 0.2rem 0.35rem 0.2rem 0; font-weight: 700; color: #16324f;">${escapeHtml(updatedUpToLabel)}</td>
              <td style="padding: 0.2rem 0;">${escapeHtml(latestBazNumber || '-')}</td>
            </tr>
            <tr>
              <td style="padding: 0.2rem 0.35rem 0.2rem 0; font-weight: 700; color: #16324f;">${escapeHtml(editionDateLabel)}</td>
              <td style="padding: 0.2rem 0;">${escapeHtml(editionDate)}</td>
            </tr>
          </tbody>
        </table>
      </header>
      <section style="margin-bottom: 1.5rem;">
        <h2 style="margin: 0 0 0.75rem; font-size: 1.05rem; color: #16324f;">${escapeHtml(activeLabel)}</h2>
        ${activeListHtml}
      </section>
      <section>
        <h2 style="margin: 0 0 0.75rem; font-size: 1.05rem; color: #16324f;">${escapeHtml(articlesLabel)}</h2>
        ${articleHtml}
      </section>
    </article>
  `;
}

export async function createCorrectionListPreview(
  productVersionId: number,
  db: QueryExecutor = pool
) {
  const versionResult = await db.query(
    `SELECT pv.id, pv.product_id, pv.version_number, pv.version_date, pv.publication_date, pv.created_at,
            p.code AS product_code, p.name AS product_name, p.description AS product_description,
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

  if (!isPublCorrectionListProduct(version)) {
    throw new Error('Product version is not a correction list');
  }

  const sourceChartCode = parseSourceChartCode(version.product_code);
  const groupedBase = String(sourceChartCode || '').trim().match(/^(104|105|107)$/)?.[1] || null;
  const sourceChartResult = groupedBase
    ? await db.query(
        `SELECT p.id, p.code, p.name
         FROM products p
         JOIN production_lines pl ON pl.id = p.production_line_id
         WHERE pl.code = 'ZK'
           AND p.type = 'chart'
           AND p.code ~ $1
         ORDER BY p.code`,
        [`^Deelkaart ${groupedBase}/[0-9]+$`]
      )
    : await db.query(
        `SELECT p.id, p.code, p.name
         FROM products p
         JOIN production_lines pl ON pl.id = p.production_line_id
         WHERE pl.code = 'ZK' AND p.code = $1
         LIMIT 1`,
        [sourceChartCode]
      );

  const sourceChartName = groupedBase
    ? `Deelkaart ${groupedBase}`
    : (sourceChartResult.rows[0]?.name || sourceChartCode);
  const versionDate = version.publication_date || version.version_date || version.created_at;

  const currentArticlesResult = await db.query(
    `SELECT ta.id, ta.baz_number, ta.book_number, ta.article_number, ta.is_temporary,
            ta.title_nl, ta.title_en, ta.content_nl, ta.content_en,
            t.id AS task_id, t.task_number, t.title AS task_title
     FROM task_products tp
     JOIN tasks t ON t.id = tp.task_id
     JOIN task_articles ta ON ta.task_id = t.id
     WHERE tp.product_id = $1
       AND tp.product_version_id = $2`,
    [version.product_id, productVersionId]
  );

  const previousPublishedResult = await db.query(
    `SELECT DISTINCT ta.baz_number
     FROM task_products tp
     JOIN task_articles ta ON ta.task_id = tp.task_id
     JOIN product_versions pv ON pv.id = tp.product_version_id
     WHERE tp.product_id = $1
       AND pv.status IN ('gepubliceerd', 'published')
       AND pv.id <> $2
       AND (
         COALESCE(pv.publication_date, pv.version_date, pv.created_at::date) < $3::date
         OR (
           COALESCE(pv.publication_date, pv.version_date, pv.created_at::date) = $3::date
           AND pv.id < $2
         )
       )`,
    [version.product_id, productVersionId, versionDate]
  );

  const publishedBazNumbers = new Set<string>(
    previousPublishedResult.rows.map((row: { baz_number: string }) => String(row.baz_number || '').trim())
  );

  const currentArticles = currentArticlesResult.rows
    .map((row: ArticleRow) => ({
      ...row,
      baz_number: String(row.baz_number || '').trim(),
      task_number: String(row.task_number || '').trim(),
      task_title: String(row.task_title || '').trim(),
    }))
    .filter((row: ArticleRow) => !!row.baz_number)
    .sort(sortArticles);

  const activeArticles = currentArticles.filter((article: ArticleRow) => !publishedBazNumbers.has(article.baz_number));
  const activeBazNumbers: string[] = Array.from(
    new Set(activeArticles.map((article: ArticleRow) => article.baz_number))
  );
  const latestBazNumber = activeArticles.length > 0
    ? activeArticles[activeArticles.length - 1].baz_number
    : '';
  const editionDateNl = formatEditionDate(new Date(), 'nl');
  const editionDateEn = formatEditionDate(new Date(), 'en');

  return {
    productVersionId,
    productId: Number(version.product_id),
    productCode: version.product_code,
    productName: version.product_name,
    sourceChartCode,
    sourceChartName,
    sourceCharts: sourceChartResult.rows,
    versionNumber: version.version_number,
    activeBazNumbers,
    articles: activeArticles,
    nl: {
      activeBazNumbers,
      html: buildCorrectionListHtml(
        'nl',
        String(version.product_name || ''),
        sourceChartCode,
        String(sourceChartName || ''),
        String(version.version_number || ''),
        latestBazNumber,
        editionDateNl,
        activeBazNumbers,
        activeArticles
      ),
    },
    en: {
      activeBazNumbers,
      html: buildCorrectionListHtml(
        'en',
        String(version.product_name || ''),
        sourceChartCode,
        String(sourceChartName || ''),
        String(version.version_number || ''),
        latestBazNumber,
        editionDateEn,
        activeBazNumbers,
        activeArticles
      ),
    },
  };
}