export const MAP_VIEWBOX = { width: 1200, height: 900, padding: 40 };

export function sortBlocks(a, b) {
  return Number(a) - Number(b);
}

export function sortBeds(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function flattenCoordinates(geometry) {
  if (!geometry) {
    return [];
  }

  if (geometry.type === "Polygon") {
    return [geometry.coordinates];
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates;
  }

  return [];
}

function buildPathFromRing(ring, transformPoint) {
  return ring
    .map(([x, y], index) => {
      const point = transformPoint(x, y);
      return `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    })
    .join(" ");
}

export function buildGeoBlocks(geoJson) {
  if (!geoJson?.features?.length) {
    return [];
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  geoJson.features.forEach((feature) => {
    flattenCoordinates(feature.geometry).forEach((polygon) => {
      polygon.forEach((ring) => {
        ring.forEach(([x, y]) => {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        });
      });
    });
  });

  const sourceWidth = Math.max(maxX - minX, 1);
  const sourceHeight = Math.max(maxY - minY, 1);
  const scale = Math.min(
    (MAP_VIEWBOX.width - MAP_VIEWBOX.padding * 2) / sourceWidth,
    (MAP_VIEWBOX.height - MAP_VIEWBOX.padding * 2) / sourceHeight
  );

  const offsetX =
    MAP_VIEWBOX.padding +
    (MAP_VIEWBOX.width - MAP_VIEWBOX.padding * 2 - sourceWidth * scale) / 2;
  const offsetY =
    MAP_VIEWBOX.padding +
    (MAP_VIEWBOX.height - MAP_VIEWBOX.padding * 2 - sourceHeight * scale) / 2;

  const transformPoint = (x, y) => ({
    x: offsetX + (x - minX) * scale,
    y: MAP_VIEWBOX.height - (offsetY + (y - minY) * scale)
  });

  const groupedBlocks = new Map();

  geoJson.features.forEach((feature) => {
    const blockId = String(feature.properties?.FID ?? "").trim();

    if (!blockId) {
      return;
    }

    const current = groupedBlocks.get(blockId) || {
      id: blockId,
      paths: [],
      points: []
    };

    flattenCoordinates(feature.geometry).forEach((polygon) => {
      polygon.forEach((ring, ringIndex) => {
        if (!ring.length) {
          return;
        }

        if (ringIndex === 0) {
          current.paths.push(`${buildPathFromRing(ring, transformPoint)} Z`);
          ring.forEach(([x, y]) => {
            current.points.push(transformPoint(x, y));
          });
        }
      });
    });

    groupedBlocks.set(blockId, current);
  });

  return [...groupedBlocks.values()]
    .map((block) => {
      const center = block.points.reduce(
        (accumulator, point) => ({
          x: accumulator.x + point.x / block.points.length,
          y: accumulator.y + point.y / block.points.length
        }),
        { x: 0, y: 0 }
      );

      return {
        id: block.id,
        path: block.paths.join(" "),
        center
      };
    })
    .sort((a, b) => sortBlocks(a.id, b.id));
}
