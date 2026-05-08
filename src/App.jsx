import { useEffect, useMemo, useState } from "react";
import { buildGeoBlocks, MAP_VIEWBOX, sortBeds } from "./lib/geo";
import { clearLocalCsv, loadReportRows, saveLocalCsv } from "./lib/reportData";
import { hasSupabaseConfig } from "./lib/supabase";

export default function App() {
  const [rows, setRows] = useState([]);
  const [geoBlocks, setGeoBlocks] = useState([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [weekFrom, setWeekFrom] = useState(1);
  const [weekTo, setWeekTo] = useState(52);
  const [weekFromInput, setWeekFromInput] = useState("1");
  const [weekToInput, setWeekToInput] = useState("52");
  const [selectedBlock, setSelectedBlock] = useState("1");
  const [activeTab, setActiveTab] = useState("mapa");
  const [sourceLabel, setSourceLabel] = useState("Cargando base...");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    loadReportRows()
      .then(({ rows: loadedRows, sourceLabel: nextLabel }) => {
        setRows(loadedRows);
        setSourceLabel(nextLabel);
      })
      .catch(() => {
        setLoadError(
          hasSupabaseConfig
            ? "No se pudo cargar la base remota de Supabase."
            : "No se pudo cargar el CSV inicial. Sube el archivo manualmente."
        );
        setSourceLabel("Sin base cargada");
      });
  }, []);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}bloques.geojson`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("No se pudo cargar el GeoJSON de bloques");
        }

        return response.json();
      })
      .then((json) => {
        setGeoBlocks(buildGeoBlocks(json));
      })
      .catch(() => {
        setLoadError((current) =>
          current || "No se pudo cargar el GeoJSON de bloques del mapa."
        );
      });
  }, []);

  const years = useMemo(() => {
    return [...new Set(rows.map((row) => row.year))].sort((a, b) => a - b);
  }, [rows]);

  useEffect(() => {
    if (!years.length) {
      return;
    }

    setSelectedYear((current) => (current ? current : String(years[years.length - 1])));
  }, [years]);

  const selectedYearRows = useMemo(() => {
    return rows.filter((row) => String(row.year) === String(selectedYear));
  }, [rows, selectedYear]);

  useEffect(() => {
    if (!selectedYearRows.length) {
      return;
    }

    const yearWeeks = selectedYearRows.map((row) => row.week);
    const minWeek = Math.min(...yearWeeks);
    const maxWeek = Math.max(...yearWeeks);

    setWeekFrom((current) => {
      const nextValue = current < minWeek || current > maxWeek ? minWeek : current;
      setWeekFromInput(String(nextValue));
      return nextValue;
    });
    setWeekTo((current) => {
      const nextValue = current < minWeek || current > maxWeek ? maxWeek : current;
      setWeekToInput(String(nextValue));
      return nextValue;
    });
  }, [selectedYearRows]);

  const filteredRows = useMemo(() => {
    return selectedYearRows.filter(
      (row) => row.week >= Number(weekFrom) && row.week <= Number(weekTo)
    );
  }, [selectedYearRows, weekFrom, weekTo]);

  const reportedBlocks = useMemo(() => {
    return new Set(filteredRows.map((row) => String(row.block)));
  }, [filteredRows]);

  const selectedBlockRows = useMemo(() => {
    return filteredRows
      .filter((row) => String(row.block) === String(selectedBlock))
      .sort((a, b) => a.week - b.week || sortBeds(a.bed, b.bed));
  }, [filteredRows, selectedBlock]);

  const bedSummary = useMemo(() => {
    const grouped = new Map();

    selectedBlockRows.forEach((row) => {
      const current = grouped.get(row.bed) || new Set();
      if (row.variety) {
        current.add(row.variety);
      }
      grouped.set(row.bed, current);
    });

    return [...grouped.entries()]
      .sort((a, b) => sortBeds(a[0], b[0]))
      .map(([bed, varieties]) => ({
        bed,
        varieties: [...varieties].sort((a, b) => a.localeCompare(b))
      }));
  }, [selectedBlockRows]);

  const stats = useMemo(() => {
    const allBlocks = geoBlocks.map((block) => String(block.id));
    const reported = allBlocks.filter((blockId) => reportedBlocks.has(blockId));

    return {
      totalReports: filteredRows.length,
      blocksWithReports: reported.length,
      blocksWithoutReports: allBlocks.length - reported.length
    };
  }, [filteredRows, geoBlocks, reportedBlocks]);

  function handleCsvUpload(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    file.text().then((text) => {
      const parsedRows = saveLocalCsv(text);
      setRows(parsedRows);
      setSourceLabel(`Base cargada: ${file.name}`);
      setLoadError("");
    });
  }

  function handleBlockSelect(blockId) {
    setSelectedBlock(String(blockId));
    setActiveTab("detalle");
  }

  function normalizeWeekInput(value) {
    return value.replace(/\D/g, "").slice(0, 2);
  }

  function commitWeekFrom(value) {
    const parsed = Number(value);
    const safeValue = Number.isFinite(parsed) && parsed > 0 ? parsed : weekFrom;
    setWeekFrom(safeValue);
    setWeekFromInput(String(safeValue));
  }

  function commitWeekTo(value) {
    const parsed = Number(value);
    const safeValue = Number.isFinite(parsed) && parsed > 0 ? parsed : weekTo;
    setWeekTo(safeValue);
    setWeekToInput(String(safeValue));
  }

  function clearStoredData() {
    clearLocalCsv();
    window.location.reload();
  }

  return (
    <main className="dashboard-shell">
      <section className="hero-banner panel">
        <div>
          <p className="eyebrow">Flores el Trigal Olas</p>
          <h1>Mapa de reporte RB</h1>
          <p className="lead">
            El bloque se marca en rojo si se reportó RB en el rango de tiempo
            seleccionado.
          </p>
        </div>

        <div className="hero-metrics">
          <div className="metric-card">
            <span>Reportes</span>
            <strong>{stats.totalReports}</strong>
          </div>
          <div className="metric-card">
            <span>Bloques con reporte</span>
            <strong>{stats.blocksWithReports}</strong>
          </div>
          <div className="metric-card">
            <span>Bloques sin reporte</span>
            <strong>{stats.blocksWithoutReports}</strong>
          </div>
        </div>
      </section>

      <section className="control-grid">
        <div className="panel filters-panel">
          <div className="panel-heading">
            <h2>Filtros</h2>
            <span>{sourceLabel}</span>
          </div>

          {!hasSupabaseConfig ? (
            <label>
              Subir CSV
              <input type="file" accept=".csv,text/csv" onChange={handleCsvUpload} />
            </label>
          ) : null}

          <div className="grid-two">
            <label>
              Año
              <select
                value={selectedYear}
                onChange={(event) => setSelectedYear(event.target.value)}
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Bloque seleccionado
              <select
                value={selectedBlock}
                onChange={(event) => setSelectedBlock(event.target.value)}
              >
                {geoBlocks.map((block) => (
                  <option key={block.id} value={block.id}>
                    Bloque {block.id}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid-two">
            <label>
              Semana desde
              <input
                type="text"
                inputMode="numeric"
                value={weekFromInput}
                onChange={(event) => setWeekFromInput(normalizeWeekInput(event.target.value))}
                onBlur={() => commitWeekFrom(weekFromInput)}
              />
            </label>

            <label>
              Semana hasta
              <input
                type="text"
                inputMode="numeric"
                value={weekToInput}
                onChange={(event) => setWeekToInput(normalizeWeekInput(event.target.value))}
                onBlur={() => commitWeekTo(weekToInput)}
              />
            </label>
          </div>

          <div className="legend">
            <div className="legend-item">
              <span className="legend-swatch reported" />
              <small>Bloque con reporte</small>
            </div>
            <div className="legend-item">
              <span className="legend-swatch clean" />
              <small>Bloque sin reporte</small>
            </div>
            <div className="legend-item">
              <span className="legend-swatch selected" />
              <small>Bloque seleccionado</small>
            </div>
          </div>

          {loadError ? <p className="error-text">{loadError}</p> : null}

          {!hasSupabaseConfig ? (
            <button type="button" className="ghost-button" onClick={clearStoredData}>
              Restaurar CSV inicial
            </button>
          ) : null}
        </div>

        <div className="panel">
          <div className="tabs">
            <button
              type="button"
              className={activeTab === "mapa" ? "tab active" : "tab"}
              onClick={() => setActiveTab("mapa")}
            >
              Mapa
            </button>
            <button
              type="button"
              className={activeTab === "detalle" ? "tab active" : "tab"}
              onClick={() => setActiveTab("detalle")}
            >
              Detalle del bloque
            </button>
          </div>

          {activeTab === "mapa" ? (
            <section className="map-view">
              <div className="map-shell">
                <svg
                  viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
                  className="farm-map"
                  role="img"
                >
                  <title>Mapa de bloques de la finca</title>
                  <g>
                    {geoBlocks.map((block) => {
                      const isReported = reportedBlocks.has(String(block.id));
                      const isSelected = String(selectedBlock) === String(block.id);
                      const className = isSelected
                        ? "map-block selected"
                        : isReported
                          ? "map-block reported"
                          : "map-block clean";

                      return (
                        <g
                          key={block.id}
                          className="block-group"
                          onClick={() => handleBlockSelect(block.id)}
                        >
                          <path d={block.path} className={className} />
                          <text
                            x={block.center.x}
                            y={block.center.y + 6}
                            textAnchor="middle"
                            className="block-label"
                          >
                            {block.id}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                </svg>
              </div>

              <div className="map-caption">
                Haz clic en cualquier bloque para abrir su detalle. El color rojo
                indica que el bloque sí aparece en la base entre la semana{" "}
                <strong>{weekFrom}</strong> y la <strong>{weekTo}</strong> del año{" "}
                <strong>{selectedYear || "-"}</strong>.
              </div>
            </section>
          ) : (
            <section className="detail-view">
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Bloque {selectedBlock}</p>
                  <h2>Detalle de camas y variedades reportadas</h2>
                </div>
                <span className="detail-badge">
                  {selectedBlockRows.length} reportes en el rango actual
                </span>
              </div>

              {selectedBlockRows.length === 0 ? (
                <article className="empty-state">
                  <h3>Sin reportes para este bloque</h3>
                  <p>
                    El bloque {selectedBlock} no aparece en la base para el año y
                    semanas seleccionadas.
                  </p>
                </article>
              ) : (
                <>
                  <div className="summary-grid">
                    {bedSummary.map((entry) => (
                      <article key={entry.bed} className="summary-card">
                        <h3>Cama {entry.bed}</h3>
                        <p>{entry.varieties.join(", ") || "Sin variedad registrada"}</p>
                      </article>
                    ))}
                  </div>

                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Año</th>
                          <th>Semana</th>
                          <th>Bloque</th>
                          <th>Cama</th>
                          <th>Variedad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedBlockRows.map((row, index) => (
                          <tr key={`${row.block}-${row.bed}-${row.week}-${index}`}>
                            <td>{row.year}</td>
                            <td>{row.week}</td>
                            <td>{row.block}</td>
                            <td>{row.bed}</td>
                            <td>{row.variety || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
