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

function splitDelimitedLine(line, delimiter) {
  const values = [];
  let currentValue = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && nextCharacter === '"') {
      currentValue += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (character === delimiter && !insideQuotes) {
      values.push(currentValue);
      currentValue = "";
      continue;
    }

    currentValue += character;
  }

  values.push(currentValue);
  return values;
}

function detectDelimiter(line) {
  return line.includes(";") ? ";" : ",";
}

function isReportHeader(headers) {
  const hasHeader = (candidates) =>
    headers.some((header) =>
      candidates.some((candidate) => header === candidate || header.includes(candidate))
    );

  return (
    hasHeader(["ANO"]) &&
    hasHeader(["SEMANA"]) &&
    hasHeader(["BLOQUE"]) &&
    hasHeader(["CAMA"]) &&
    hasHeader(["VARIEDAD"])
  );
}

export function parseCsvText(text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());

  if (lines.length < 2) {
    return [];
  }

  const headerLineIndex = lines.findIndex((line) => {
    const delimiter = detectDelimiter(line);
    const headers = splitDelimitedLine(line, delimiter).map(normalizeHeader);
    return isReportHeader(headers);
  });

  if (headerLineIndex < 0) {
    return [];
  }

  const delimiter = detectDelimiter(lines[headerLineIndex]);
  const headers = splitDelimitedLine(lines[headerLineIndex], delimiter).map(normalizeHeader);
  const yearIndex = getHeaderIndex(headers, ["ANO"], 0);
  const weekIndex = getHeaderIndex(headers, ["SEMANA"], 1);
  const blockIndex = getHeaderIndex(headers, ["BLOQUE"], 2);
  const bedIndex = getHeaderIndex(headers, ["CAMA"], 3);
  const varietyIndex = getHeaderIndex(headers, ["VARIEDAD"], headers.length - 1);

  return lines
    .slice(headerLineIndex + 1)
    .map((line) => {
      const values = splitDelimitedLine(line, delimiter);

      return {
        year: Number((values[yearIndex] || "").trim()),
        week: Number((values[weekIndex] || "").trim()),
        block: String(values[blockIndex] || "").trim(),
        bed: String(values[bedIndex] || "").trim(),
        variety: String(values[varietyIndex] || "").trim()
      };
    })
    .filter(
      (row) =>
        row.block &&
        Number.isFinite(row.year) &&
        Number.isFinite(row.week) &&
        row.year > 0 &&
        row.week > 0
    );
}
