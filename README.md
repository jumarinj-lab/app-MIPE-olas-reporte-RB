# Mapa de reporte RB

Aplicacion web para visualizar reportes de roya blanca (RB) por bloque en `Flores el Trigal Olas`.

La app puede trabajar de dos formas:

- con una base local CSV
- conectada a Supabase como base remota

Filtra por año y rango de semanas, colorea en rojo los bloques con reporte y permite abrir el detalle de camas y variedades por bloque.

## Stack

- React 18
- Vite
- Supabase JS
- GeoJSON exportado desde QGIS
- CSV local como fuente de respaldo

## Funcionalidades

- Filtro por anio
- Filtro por semana desde y semana hasta
- Mapa interactivo por bloques
- Resaltado de bloques con reporte RB
- Vista detalle por bloque
- Carga manual de un nuevo archivo CSV
- Persistencia del ultimo CSV cargado en `localStorage`
- Conexion opcional a Supabase
- Preparacion para despliegue en GitHub Pages

## Estructura del proyecto

```text
public/
  bloques.geojson      # geometria real de bloques exportada desde QGIS
  mapa-finca.png       # imagen del mapa si se quiere reutilizar despues
  roya-blanca.csv      # base local inicial de reportes
src/
  App.jsx              # logica principal de la aplicacion
  lib/
    csv.js             # parser del CSV
    geo.js             # transformacion de bloques GeoJSON a SVG
    reportData.js      # carga de datos local o remota
    supabase.js        # cliente y config de Supabase
  main.jsx             # entrada de React
  styles.css           # estilos de la interfaz
.github/workflows/
  deploy-pages.yml     # despliegue automatico a GitHub Pages
.env.example
supabase-schema.sql
index.html
package.json
vite.config.js
```

## Datos usados

### CSV de reportes local

La app usa estas columnas del archivo CSV:

- `AÑO`
- `SEMANA`
- `BLOQUE`
- `CAMA`
- `VARIEDAD`

El bloque se marca en rojo cuando existe al menos un registro del bloque en el rango de tiempo seleccionado.

### Supabase

La tabla esperada en Supabase es `rb_reports` con estas columnas:

- `year` integer
- `week` integer
- `block` text
- `bed` text
- `variety` text

El archivo [supabase-schema.sql](/C:/Users/HP/Documents/mvp-local-app/supabase-schema.sql:1) incluye una version inicial de la tabla e indices.

### GeoJSON de bloques

La app usa `public/bloques.geojson`.

- El identificador del bloque sale de `FID`
- Los bloques `28` y `51` pueden venir en mas de una geometria, pero se muestran como un solo bloque funcional

## Ejecutar en local

```bash
npm install
npm run dev
```

Si quieres usar Supabase, crea un archivo `.env` basado en `.env.example`:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

En Windows PowerShell tambien funciona:

```powershell
npm.cmd install
npm.cmd run dev
```

## Build

```bash
npm run build
```

## Configurar Supabase

1. Crea un proyecto en Supabase.
2. Ejecuta el SQL de [supabase-schema.sql](/C:/Users/HP/Documents/mvp-local-app/supabase-schema.sql:1) en el SQL Editor.
3. Importa tus datos de roya blanca a la tabla `rb_reports`.
4. Crea `.env` con:

```bash
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY
```

5. Reinicia la app local.

Cuando hay variables de Supabase, la app intenta leer la base remota. Si no existen, usa el CSV local.

## Desplegar como pagina

El repo ya incluye workflow para `GitHub Pages`.

Debes agregar estos secretos en GitHub:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Luego activa Pages en el repositorio:

1. `Settings`
2. `Pages`
3. `Build and deployment`
4. `Source: GitHub Actions`

Cada `push` a `main` generara la pagina.

## Estado actual

El proyecto ya esta conectado a este repositorio:

- `https://github.com/jumarinj-lab/app-MIPE-olas-reporte-RB`
