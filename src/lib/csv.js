export function normalizeHeader(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\uFFFD/g, "N")
    .trim()
    .toUpperCase();
}

export function getHeaderIndex(headers, candidates, fallbackIndex) {
  const foundIndex = headers.findIndex((header) =>
    candidates.some((candidate) => header === candidate || header.includes(candidate))
  );

  return foundIndex >= 0 ? foundIndex : fallbackIndex;
}

export function parseCsvText(text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(";").map(normalizeHeader);
  const yearIndex = getHeaderIndex(headers, ["ANO"], 0);
  const weekIndex = getHeaderIndex(headers, ["SEMANA"], 1);
  const blockIndex = getHeaderIndex(headers, ["BLOQUE"], 2);
  const bedIndex = getHeaderIndex(headers, ["CAMA"], 3);
  const varietyIndex = getHeaderIndex(headers, ["VARIEDAD"], headers.length - 1);

  return lines
    .slice(1)
    .map((line) => {
      const values = line.split(";");

      return {
        year: Number((values[yearIndex] || "").trim()),
        week: Number((values[weekIndex] || "").trim()),
        block: String(values[blockIndex] || "").trim(),
        bed: String(values[bedIndex] || "").trim(),
        variety: String(values[varietyIndex] || "").trim()
      };
    })
    .filter((row) => row.block && Number.isFinite(row.year) && Number.isFinite(row.week));
}
