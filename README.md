# Mapa de reporte RB

Aplicacion web local para visualizar reportes de roya blanca (RB) por bloque en `Flores el Trigal Olas`.

La app carga una base CSV de reportes, filtra por anio y rango de semanas, colorea en rojo los bloques con reporte y permite abrir el detalle de camas y variedades por bloque.

## Stack

- React 18
- Vite
- GeoJSON exportado desde QGIS
- CSV local como fuente de reportes

## Funcionalidades

- Filtro por anio
- Filtro por semana desde y semana hasta
- Mapa interactivo por bloques
- Resaltado de bloques con reporte RB
- Vista detalle por bloque
- Carga manual de un nuevo archivo CSV
- Persistencia del ultimo CSV cargado en `localStorage`

## Estructura del proyecto

```text
public/
  bloques.geojson      # geometria real de bloques exportada desde QGIS
  mapa-finca.png       # imagen del mapa si se quiere reutilizar despues
  roya-blanca.csv      # base local inicial de reportes
src/
  App.jsx              # logica principal de la aplicacion
  main.jsx             # entrada de React
  styles.css           # estilos de la interfaz
index.html
package.json
vite.config.js
```

## Datos usados

### CSV de reportes

La app usa estas columnas del archivo CSV:

- `AÑO`
- `SEMANA`
- `BLOQUE`
- `CAMA`
- `VARIEDAD`

El bloque se marca en rojo cuando existe al menos un registro del bloque en el rango de tiempo seleccionado.

### GeoJSON de bloques

La app usa `public/bloques.geojson`.

- El identificador del bloque sale de `FID`
- Los bloques `28` y `51` pueden venir en mas de una geometria, pero se muestran como un solo bloque funcional

## Ejecutar en local

```bash
npm install
npm run dev
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

## Publicar en GitHub

1. Crea un repositorio vacio en GitHub.
2. Inicializa Git localmente si aun no existe.
3. Agrega los archivos.
4. Crea el primer commit.
5. Conecta el remoto.
6. Haz `push` a `main`.

Comandos de referencia:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <URL_DEL_REPOSITORIO>
git push -u origin main
```
