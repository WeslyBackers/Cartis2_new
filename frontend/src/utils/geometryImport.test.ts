import test from 'node:test';
import assert from 'node:assert/strict';

import { parseImportedGeometryText } from './geometryImport.ts';

test('parses a KML point geometry', () => {
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Placemark>
    <name>Point</name>
    <Point>
      <coordinates>4.123,51.456</coordinates>
    </Point>
  </Placemark>
</kml>`;

  const result = parseImportedGeometryText('point.kml', kml);
  assert.equal(result.length, 1);
  assert.equal(result[0].type, 'Point');
  assert.deepEqual(result[0].coordinates, [4.123, 51.456]);
});

test('parses a GML polygon geometry', () => {
  const gml = `<?xml version="1.0" encoding="UTF-8"?>
<gml:Polygon xmlns:gml="http://www.opengis.net/gml">
  <gml:exterior>
    <gml:LinearRing>
      <gml:posList>4.1 51.1 4.2 51.1 4.2 51.2 4.1 51.2 4.1 51.1</gml:posList>
    </gml:LinearRing>
  </gml:exterior>
</gml:Polygon>`;

  const result = parseImportedGeometryText('area.gml', gml);
  assert.equal(result.length, 1);
  assert.equal(result[0].type, 'Polygon');
  assert.equal(result[0].coordinates[0][0][0], 4.1);
  assert.equal(result[0].coordinates[0][0][1], 51.1);
});

test('parses a GML linestring geometry', () => {
  const gml = `<?xml version="1.0" encoding="UTF-8"?>
<gml:LineString xmlns:gml="http://www.opengis.net/gml">
  <gml:posList>4.1 51.1 4.2 51.2</gml:posList>
</gml:LineString>`;

  const result = parseImportedGeometryText('line.gml', gml);
  assert.equal(result.length, 1);
  assert.equal(result[0].type, 'LineString');
  assert.deepEqual(result[0].coordinates, [[4.1, 51.1], [4.2, 51.2]]);
});
