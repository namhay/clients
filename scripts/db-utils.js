/** Check whether a column exists on a public schema table. */
async function hasColumn(sql, table, column) {
  const rows = await sql`
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = ${table}
      AND a.attname = ${column}
      AND a.attnum > 0
      AND NOT a.attisdropped
    LIMIT 1
  `
  return rows.length > 0
}

module.exports = { hasColumn }
