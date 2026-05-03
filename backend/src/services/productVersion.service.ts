import pool from '../config/database';
import { isPublCorrectionListProduct } from './correctionList.service';

type QueryExecutor = {
  query: (text: string, params?: any[]) => Promise<any>;
};

function buildAutoVersionNumber(productId: number): string {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const suffix = Math.floor(Math.random() * 900 + 100);
  return `AUTO-${productId}-${timestamp}-${suffix}`;
}

function parseEncVersion(versionNumber: string | null | undefined): { edition: number; update: number } | null {
  if (!versionNumber) return null;

  const match = versionNumber.match(/edition\s*(\d+)\s*update\s*(\d+)/i);
  if (!match) return null;

  return {
    edition: Number(match[1]),
    update: Number(match[2]),
  };
}

function formatEncVersion(edition: number, update: number): string {
  return `Edition ${String(edition).padStart(2, '0')} Update ${String(update).padStart(2, '0')}`;
}

function parseBaz2Version(versionNumber: string | null | undefined): { year: number; issue: number } | null {
  if (!versionNumber) return null;

  const match = String(versionNumber).trim().match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;

  return {
    year: Number(match[1]),
    issue: Number(match[2]),
  };
}

function formatBaz2Version(year: number, issue: number): string {
  return `${year}-${String(issue).padStart(2, '0')}`;
}

function normalizeValue(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

async function isPublLichtenlijstProduct(productId: number, db: QueryExecutor): Promise<boolean> {
  const productResult = await db.query(
    `SELECT p.code, p.name, pl.code as production_line_code
     FROM products p
     LEFT JOIN production_lines pl ON p.production_line_id = pl.id
     WHERE p.id = $1`,
    [productId]
  );

  if (productResult.rows.length === 0) {
    throw new Error('Product not found while creating product version');
  }

  const productionLineCode = String(productResult.rows[0].production_line_code || '').trim().toUpperCase();
  const normalizedCode = normalizeValue(productResult.rows[0].code);
  const normalizedName = normalizeValue(productResult.rows[0].name);

  return productionLineCode === 'PUBL' && (
    normalizedCode.includes('lichtenlijst') ||
    normalizedName.includes('lichtenlijst')
  );
}

async function isPublCorrectionListVersionProduct(productId: number, db: QueryExecutor): Promise<boolean> {
  const productResult = await db.query(
    `SELECT p.code AS product_code, p.name AS product_name, pl.code AS production_line_code
     FROM products p
     LEFT JOIN production_lines pl ON p.production_line_id = pl.id
     WHERE p.id = $1`,
    [productId]
  );

  if (productResult.rows.length === 0) {
    throw new Error('Product not found while creating product version');
  }

  return isPublCorrectionListProduct(productResult.rows[0]);
}

async function isChartProduct(productId: number, db: QueryExecutor): Promise<{ isChart: boolean; productName: string }> {
  const productResult = await db.query(
    `SELECT type, name
     FROM products
     WHERE id = $1`,
    [productId]
  );

  if (productResult.rows.length === 0) {
    throw new Error('Product not found while creating product version');
  }

  const productType = String(productResult.rows[0].type || '').trim().toLowerCase();
  return {
    isChart: productType === 'chart',
    productName: String(productResult.rows[0].name || '').trim(),
  };
}

async function isEncProduct(productId: number, db: QueryExecutor): Promise<boolean> {
  const productResult = await db.query(
    `SELECT type
     FROM products
     WHERE id = $1`,
    [productId]
  );

  if (productResult.rows.length === 0) {
    throw new Error('Product not found while creating product version');
  }

  const productType = String(productResult.rows[0].type || '').toLowerCase();
  return productType.includes('enc');
}

async function isBaz2Product(productId: number, db: QueryExecutor): Promise<boolean> {
  const productResult = await db.query(
    `SELECT code
     FROM products
     WHERE id = $1`,
    [productId]
  );

  if (productResult.rows.length === 0) {
    throw new Error('Product not found while creating product version');
  }

  const productCode = String(productResult.rows[0].code || '').trim().toLowerCase();
  return productCode === 'baz-2';
}

export async function generateNextVersionNumber(
  productId: number,
  opts?: { newEdition?: boolean },
  db: QueryExecutor = pool
): Promise<string> {
  const newEdition = !!opts?.newEdition;
  const baz2Product = await isBaz2Product(productId, db);
  const publLichtenlijstProduct = await isPublLichtenlijstProduct(productId, db);
  const publCorrectionListProduct = await isPublCorrectionListVersionProduct(productId, db);

  if (publLichtenlijstProduct) {
    const currentYear = new Date().getFullYear();
    const yearPrefix = `${currentYear}-`;

    const sameYearResult = await db.query(
      `SELECT version_number
       FROM product_versions
       WHERE product_id = $1
         AND version_number LIKE $2`,
      [productId, `${yearPrefix}%`]
    );

    let maxIssue = 0;

    for (const row of sameYearResult.rows) {
      const parsed = parseBaz2Version(row.version_number);
      if (!parsed || parsed.year !== currentYear) continue;
      if (parsed.issue > maxIssue) {
        maxIssue = parsed.issue;
      }
    }

    return formatBaz2Version(currentYear, maxIssue + 1);
  }

  if (baz2Product) {
    const latestAnyResult = await db.query(
      `SELECT version_number
       FROM product_versions
       WHERE product_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [productId]
    );

    const latestAnyParsed = parseBaz2Version(latestAnyResult.rows[0]?.version_number);

    if (!latestAnyParsed) {
      return formatBaz2Version(new Date().getFullYear(), 2);
    }

    if (latestAnyParsed.issue >= 26) {
      return formatBaz2Version(latestAnyParsed.year + 1, 2);
    }

    const nextIssue = Math.max(2, latestAnyParsed.issue + 1);
    return formatBaz2Version(latestAnyParsed.year, nextIssue);
  }

  if (publCorrectionListProduct) {
    const latestAnyResult = await db.query(
      `SELECT version_number
       FROM product_versions
       WHERE product_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [productId]
    );

    const latestAnyParsed = parseEncVersion(latestAnyResult.rows[0]?.version_number);

    if (newEdition) {
      const latestPublishedResult = await db.query(
        `SELECT version_number
         FROM product_versions
         WHERE product_id = $1
           AND status = 'published'
         ORDER BY COALESCE(publication_date, version_date, created_at::date) DESC, created_at DESC, id DESC
         LIMIT 1`,
        [productId]
      );

      const latestPublishedParsed = parseEncVersion(latestPublishedResult.rows[0]?.version_number);
      const currentEdition = latestPublishedParsed?.edition ?? latestAnyParsed?.edition ?? 0;
      return formatEncVersion(currentEdition + 1, 0);
    }

    if (latestAnyParsed) {
      return formatEncVersion(latestAnyParsed.edition, latestAnyParsed.update + 1);
    }

    return formatEncVersion(1, 0);
  }

  const { isChart, productName } = await isChartProduct(productId, db);

  if (isChart) {
    return `${productName}_DD/MM/YYYY`;
  }

  const encProduct = await isEncProduct(productId, db);

  if (!encProduct) {
    return buildAutoVersionNumber(productId);
  }

  const latestAnyResult = await db.query(
    `SELECT version_number
     FROM product_versions
     WHERE product_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [productId]
  );

  const latestAnyParsed = parseEncVersion(latestAnyResult.rows[0]?.version_number);

  if (newEdition) {
    const latestPublishedResult = await db.query(
      `SELECT version_number
       FROM product_versions
       WHERE product_id = $1
         AND status = 'published'
       ORDER BY COALESCE(publication_date, version_date, created_at::date) DESC, created_at DESC, id DESC
       LIMIT 1`,
      [productId]
    );

    const latestPublishedParsed = parseEncVersion(latestPublishedResult.rows[0]?.version_number);
    const currentEdition = latestPublishedParsed?.edition ?? latestAnyParsed?.edition ?? 0;
    return formatEncVersion(currentEdition + 1, 0);
  }

  if (latestAnyParsed) {
    return formatEncVersion(latestAnyParsed.edition, latestAnyParsed.update + 1);
  }

  return formatEncVersion(1, 0);
}

export async function getOrCreateInProgressProductVersion(
  productId: number,
  opts?: { userId?: number | null; newEdition?: boolean; notes?: string },
  db: QueryExecutor = pool
): Promise<number> {
  const userId = opts?.userId;
  const newEdition = !!opts?.newEdition;
  const notes = opts?.notes || 'Automatisch aangemaakt voor openstaande taken';

  const existingResult = await db.query(
    `SELECT id
     FROM product_versions
     WHERE product_id = $1
       AND status = 'in_progress'
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [productId]
  );

  if (existingResult.rows.length > 0) {
    return Number(existingResult.rows[0].id);
  }

  const versionNumber = await generateNextVersionNumber(productId, { newEdition }, db);

  const createResult = await db.query(
    `INSERT INTO product_versions
      (product_id, version_number, version_date, status, notes, created_by)
     VALUES ($1, $2, CURRENT_DATE, 'in_progress', $3, $4)
     RETURNING id`,
    [
      productId,
      versionNumber,
      notes,
      userId ?? null,
    ]
  );

  return Number(createResult.rows[0].id);
}
