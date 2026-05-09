import { Fragment, useEffect, useMemo, useState } from "react";
import { utils, writeFile } from "xlsx";
import { buildGeoBlocks, MAP_VIEWBOX, sortBeds } from "./lib/geo";
import { clearLocalCsv, loadReportRows, saveLocalCsv, syncSupabaseRowsFromCsv } from "./lib/reportData";
import { hasSupabaseConfig, supabase } from "./lib/supabase";

const ADMIN_EMAIL = "jefemipe@trigal.com";

const initialAuthForm = {
  email: "",
  password: ""
};

function AuthScreen({ authForm, authError, authLoading, onChange, onSubmit }) {
  return (
    <main className="auth-shell">
      <section className="auth-card panel">
        <p className="eyebrow">Flores el Trigal Olas</p>
        <h1>Ingreso al mapa de reporte RB</h1>
        <p className="lead">
          Inicia sesión con tu correo y contraseña para consultar la información
          de roya blanca.
        </p>

        <form className="auth-form" onSubmit={onSubmit}>
          <label>
            Correo
            <input
              name="email"
              type="email"
              value={authForm.email}
              onChange={onChange}
              placeholder="nombre@empresa.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Contraseña
            <input
              name="password"
              type="password"
              value={authForm.password}
              onChange={onChange}
              placeholder="Tu contraseña"
              autoComplete="current-password"
              required
            />
          </label>

          {authError ? <p className="error-text">{authError}</p> : null}

          <button type="submit" className="primary-button" disabled={authLoading}>
            {authLoading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </section>
    </main>
  );
}

function getSeverityClass(reportCount) {
  if (reportCount === 1) {
    return "severity-once";
  }

  if (reportCount >= 2 && reportCount <= 3) {
    return "severity-low";
  }

  if (reportCount >= 4 && reportCount <= 6) {
    return "severity-medium";
  }

  if (reportCount >= 7 && reportCount <= 10) {
    return "severity-high";
  }

  if (reportCount > 10) {
    return "severity-overflow";
  }

  return "";
}

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
  const [session, setSession] = useState(null);
  const [authResolved, setAuthResolved] = useState(!hasSupabaseConfig);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authForm, setAuthForm] = useState(initialAuthForm);
  const [uploadingReports, setUploadingReports] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [expandedRowKey, setExpandedRowKey] = useState(null);
  const [selectedBeds, setSelectedBeds] = useState({});

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      return undefined;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setAuthResolved(true);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setAuthResolved(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (hasSupabaseConfig && !session) {
      setRows([]);
      setSourceLabel("Inicia sesión para cargar la base");
      return;
    }

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
  }, [session]);

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

  const isAdmin = session?.user?.email?.toLowerCase() === ADMIN_EMAIL;

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

  const historicalRowsByBed = useMemo(() => {
    const grouped = new Map();

    rows
      .filter((row) => String(row.block) === String(selectedBlock))
      .forEach((row) => {
        const current = grouped.get(row.bed) || [];
        current.push(row);
        grouped.set(row.bed, current);
      });

    grouped.forEach((bedRows, bed) => {
      grouped.set(
        bed,
        bedRows.sort((a, b) => a.year - b.year || a.week - b.week || sortBeds(a.bed, b.bed))
      );
    });

    return grouped;
  }, [rows, selectedBlock]);

  const reportCountByBed = useMemo(() => {
    const counts = new Map();
    historicalRowsByBed.forEach((bedRows, bed) => {
      counts.set(bed, bedRows.length);
    });
    return counts;
  }, [historicalRowsByBed]);

  const historyTableByBed = useMemo(() => {
    const historyMap = new Map();

    historicalRowsByBed.forEach((bedRows, bed) => {
      const rowsByYear = new Map();

      bedRows.forEach((row) => {
        const current = rowsByYear.get(row.year) || {
          year: row.year,
          weeks: new Set(),
          varieties: new Set()
        };

        current.weeks.add(row.week);

        if (row.variety) {
          current.varieties.add(row.variety);
        }

        rowsByYear.set(row.year, current);
      });

      historyMap.set(
        bed,
        [...rowsByYear.values()]
          .sort((a, b) => a.year - b.year)
          .map((entry) => ({
            year: entry.year,
            weeks: [...entry.weeks].sort((a, b) => a - b),
            varieties: [...entry.varieties].sort((a, b) => a.localeCompare(b))
          }))
      );
    });

    return historyMap;
  }, [historicalRowsByBed]);

  const stats = useMemo(() => {
    const allBlocks = geoBlocks.map((block) => String(block.id));
    const reported = allBlocks.filter((blockId) => reportedBlocks.has(blockId));

    return {
      totalReports: filteredRows.length,
      blocksWithReports: reported.length,
      blocksWithoutReports: allBlocks.length - reported.length
    };
  }, [filteredRows, geoBlocks, reportedBlocks]);

  const selectedBedEntries = useMemo(() => {
    return Object.entries(selectedBeds)
      .filter(([, value]) => value)
      .map(([key]) => {
        const [block, bed] = key.split("__");
        return { block, bed };
      })
      .sort((a, b) => Number(a.block) - Number(b.block) || sortBeds(a.bed, b.bed));
  }, [selectedBeds]);

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

  async function handleSupabaseCsvUpload(event) {
    const file = event.target.files?.[0];

    if (!file || !isAdmin) {
      return;
    }

    setUploadingReports(true);
    setUploadMessage("");
    setLoadError("");

    try {
      const text = await file.text();
      const { rows: syncedRows, insertedCount, deletedCount } = await syncSupabaseRowsFromCsv(text);
      setRows(syncedRows);
      setSourceLabel(`Base remota actualizada: ${file.name}`);
      setUploadMessage(
        `Sincronización completa. Nuevos: ${insertedCount}. Eliminados por limpieza: ${deletedCount}.`
      );
    } catch (_error) {
      setLoadError("No se pudo actualizar la base remota con el CSV.");
    } finally {
      setUploadingReports(false);
      event.target.value = "";
    }
  }

  function handleBlockSelect(blockId) {
    setSelectedBlock(String(blockId));
    setExpandedRowKey(null);
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

  function handleAuthChange(event) {
    const { name, value } = event.target;
    setAuthForm((current) => ({ ...current, [name]: value }));
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();

    if (!supabase) {
      return;
    }

    setAuthLoading(true);
    setAuthError("");

    const { error } = await supabase.auth.signInWithPassword({
      email: authForm.email,
      password: authForm.password
    });

    if (error) {
      setAuthError("No se pudo iniciar sesión. Verifica tus credenciales.");
      setAuthLoading(false);
      return;
    }

    setAuthForm(initialAuthForm);
    setAuthLoading(false);
  }

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
  }

  function toggleRowDetail(rowKey) {
    setExpandedRowKey((current) => (current === rowKey ? null : rowKey));
  }

  function getBedSelectionKey(block, bed) {
    return `${block}__${bed}`;
  }

  function toggleBedSelection(block, bed) {
    const selectionKey = getBedSelectionKey(block, bed);
    setSelectedBeds((current) => ({
      ...current,
      [selectionKey]: !current[selectionKey]
    }));
  }

  function exportSelectedBeds() {
    if (!selectedBedEntries.length) {
      return;
    }

    const workbook = utils.book_new();
    const worksheet = utils.json_to_sheet(
      selectedBedEntries.map((entry) => ({
        BLOQUE: entry.block,
        CAMA: entry.bed
      }))
    );

    utils.book_append_sheet(workbook, worksheet, "Camas seleccionadas");
    writeFile(workbook, "camas-seleccionadas-rb.xlsx");
  }

  function clearSelectedBeds() {
    setSelectedBeds({});
  }

  if (hasSupabaseConfig && !authResolved) {
    return (
      <main className="auth-shell">
        <section className="auth-card panel">
          <p className="eyebrow">Flores el Trigal Olas</p>
          <h1>Mapa de reporte RB</h1>
          <p className="lead">Verificando sesión...</p>
        </section>
      </main>
    );
  }

  if (hasSupabaseConfig && !session) {
    return (
      <AuthScreen
        authForm={authForm}
        authError={authError}
        authLoading={authLoading}
        onChange={handleAuthChange}
        onSubmit={handleAuthSubmit}
      />
    );
  }

  return (
    <main className="dashboard-shell">
      <section className="hero-banner panel">
        <div>
          <p className="eyebrow">Flores el Trigal Olas</p>
          <h1>Mapa de reporte RB</h1>
          <p className="lead">
            El bloque se marca en rojo si se reportó RB en el rango de tiempo seleccionado.
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

        {hasSupabaseConfig && session?.user ? (
          <div className="session-bar">
            <small>{session.user.email}</small>
            <button type="button" className="ghost-button" onClick={handleSignOut}>
              Cerrar sesión
            </button>
          </div>
        ) : null}
      </section>

      <section className="control-grid">
        <div className="panel filters-panel">
          <div className="panel-heading">
            <h2>Filtros</h2>
            <span className="source-pill">{sourceLabel}</span>
          </div>

          {!hasSupabaseConfig ? (
            <label>
              Subir CSV
              <input type="file" accept=".csv,text/csv" onChange={handleCsvUpload} />
            </label>
          ) : null}

          {hasSupabaseConfig && isAdmin ? (
            <label>
              Actualizar base remota
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleSupabaseCsvUpload}
                disabled={uploadingReports}
              />
              <small className="helper-text">
                Inserta solo registros nuevos. Si la base supera el límite configurado,
                elimina automáticamente los más viejos.
              </small>
            </label>
          ) : null}

          {uploadMessage ? <p className="success-text">{uploadMessage}</p> : null}

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

          <div className="selection-summary">
            <div>
              <span className="selection-label">Camas totales seleccionadas</span>
              <strong>{selectedBedEntries.length}</strong>
            </div>
            <div className="selection-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={clearSelectedBeds}
                disabled={!selectedBedEntries.length}
              >
                Limpiar selección
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={exportSelectedBeds}
                disabled={!selectedBedEntries.length}
              >
                Descargar Excel
              </button>
            </div>
          </div>

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
                Haz clic en cualquier bloque para abrir su detalle. El color rojo indica que
                el bloque sí aparece en la base entre la semana <strong>{weekFrom}</strong> y la{" "}
                <strong>{weekTo}</strong> del año <strong>{selectedYear || "-"}</strong>.
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
                    El bloque {selectedBlock} no aparece en la base para el año y semanas
                    seleccionadas.
                  </p>
                </article>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Año</th>
                        <th>Semana</th>
                        <th>Bloque</th>
                        <th>Cama</th>
                        <th>Variedad</th>
                        <th>Detalle</th>
                        <th>Seleccionar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBlockRows.map((row, index) => {
                        const rowKey = `${row.year}-${row.week}-${row.block}-${row.bed}-${row.variety}-${index}`;
                        const reportCount = reportCountByBed.get(row.bed) || 0;
                        const historyRows = historyTableByBed.get(row.bed) || [];
                        const isExpanded = expandedRowKey === rowKey;
                        const selectionKey = getBedSelectionKey(row.block, row.bed);
                        const isSelectedBed = Boolean(selectedBeds[selectionKey]);

                        return (
                          <Fragment key={rowKey}>
                            <tr className={getSeverityClass(reportCount)}>
                              <td>{row.year}</td>
                              <td>{row.week}</td>
                              <td>{row.block}</td>
                              <td>
                                {row.bed}
                                <small className="bed-count">{reportCount} reportes</small>
                              </td>
                              <td>{row.variety || "-"}</td>
                              <td>
                                <button
                                  type="button"
                                  className="detail-toggle"
                                  onClick={() => toggleRowDetail(rowKey)}
                                >
                                  {isExpanded ? "Ocultar detalle" : "Ver detalle"}
                                </button>
                              </td>
                              <td>
                                <label className="select-bed-toggle">
                                  <input
                                    type="checkbox"
                                    checked={isSelectedBed}
                                    onChange={() => toggleBedSelection(row.block, row.bed)}
                                  />
                                  <span>Seleccionar</span>
                                </label>
                              </td>
                            </tr>
                            {isExpanded ? (
                              <tr className="detail-history-row">
                                <td colSpan="7">
                                  <div className="history-panel">
                                    <h3>Historial de la cama {row.bed} en el bloque {row.block}</h3>
                                    <div className="history-table-wrapper">
                                      <table className="history-table">
                                        <thead>
                                          <tr>
                                            <th>Año</th>
                                            <th>Semanas reportadas</th>
                                            <th>Variedades</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {historyRows.map((historyRow) => (
                                            <tr key={`${row.bed}-${historyRow.year}`}>
                                              <td>{historyRow.year}</td>
                                              <td>{historyRow.weeks.join(", ")}</td>
                                              <td>{historyRow.varieties.join(", ") || "-"}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
