import { parseCsvText } from "./csv";
import { hasSupabaseConfig, supabase } from "./supabase";

const LOCAL_STORAGE_KEY = "roya-blanca-map-data";
const TABLE_NAME = "rb_reports";
const CSV_URL = `${import.meta.env.BASE_URL}roya-blanca.csv`;
const PAGE_SIZE = 1000;

function mapSupabaseRow(row) {
  return {
    year: Number(row.year),
    week: Number(row.week),
    block: String(row.block ?? "").trim(),
    bed: String(row.bed ?? "").trim(),
    variety: String(row.variety ?? "").trim()
  };
}

export async function loadReportRows() {
  if (hasSupabaseConfig && supabase) {
    const allRows = [];
    let from = 0;

    while (true) {
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select("year, week, block, bed, variety")
        .order("year", { ascending: true })
        .order("week", { ascending: true })
        .range(from, to);

      if (error) {
        throw error;
      }

      allRows.push(...data.map(mapSupabaseRow));

      if (data.length < PAGE_SIZE) {
        break;
      }

      from += PAGE_SIZE;
    }

    return {
      rows: allRows,
      sourceLabel: "Base remota: Supabase"
    };
  }

  const storedText = localStorage.getItem(LOCAL_STORAGE_KEY);

  if (storedText) {
    return {
      rows: parseCsvText(storedText),
      sourceLabel: "Base cargada desde la ultima version subida"
    };
  }

  const response = await fetch(CSV_URL);

  if (!response.ok) {
    throw new Error("No se pudo cargar el CSV inicial");
  }

  const text = await response.text();
  localStorage.setItem(LOCAL_STORAGE_KEY, text);

  return {
    rows: parseCsvText(text),
    sourceLabel: "Base inicial: roya-blanca.csv"
  };
}

export function saveLocalCsv(text) {
  localStorage.setItem(LOCAL_STORAGE_KEY, text);
  return parseCsvText(text);
}

export function clearLocalCsv() {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}
