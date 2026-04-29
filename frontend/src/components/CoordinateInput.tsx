import { useState, useEffect } from 'react';
import proj4 from 'proj4';

// --- Projection definitions ---
proj4.defs('EPSG:31370', '+proj=lcc +lat_1=51.16666723333333 +lat_2=49.8333339 +lat_0=90 +lon_0=4.367486666666666 +x_0=150000.013 +y_0=5400088.438 +ellps=intl +towgs84=-106.8686,52.2978,-103.7239,0.3366,-0.457,1.8422,-1.2747 +units=m +no_defs');
proj4.defs('EPSG:3812', '+proj=lcc +lat_1=49.8333339 +lat_2=51.16666723333333 +lat_0=50.797815 +lon_0=4.359215833333333 +x_0=649328 +y_0=665262 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');
proj4.defs('EPSG:25831', '+proj=utm +zone=31 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');
proj4.defs('EPSG:32631', '+proj=utm +zone=31 +datum=WGS84 +units=m +no_defs');

export type CoordFormat = 'DD' | 'DDM' | 'DMS' | 'EPSG:31370' | 'EPSG:3812' | 'EPSG:25831' | 'EPSG:32631';

const GEOGRAPHIC_FORMATS: CoordFormat[] = ['DD', 'DDM', 'DMS'];
const PROJECTED_FORMATS: CoordFormat[] = ['EPSG:31370', 'EPSG:3812', 'EPSG:25831', 'EPSG:32631'];

const FORMAT_LABELS: Record<CoordFormat, string> = {
  'DD': 'Decimale graden',
  'DDM': 'Graden dec. min.',
  'DMS': 'Graden min. sec.',
  'EPSG:31370': 'Lambert 72',
  'EPSG:3812': 'Lambert 2008',
  'EPSG:25831': 'ETRS89/UTM31N',
  'EPSG:32631': 'WGS84/UTM31N',
};

export function isProjectedFormat(fmt: CoordFormat): boolean {
  return PROJECTED_FORMATS.includes(fmt);
}

// --- Geographic conversion helpers ---
function ddToDdm(dd: number): { deg: number; min: number } {
  const deg = Math.floor(Math.abs(dd));
  const min = (Math.abs(dd) - deg) * 60;
  return { deg, min: Math.round(min * 10000) / 10000 };
}

function ddToDms(dd: number): { deg: number; min: number; sec: number } {
  const absDd = Math.abs(dd);
  const deg = Math.floor(absDd);
  const minFull = (absDd - deg) * 60;
  const min = Math.floor(minFull);
  const sec = Math.round((minFull - min) * 60 * 1000) / 1000;
  return { deg, min, sec };
}

function ddmToDd(deg: number, min: number, isNegative: boolean): number {
  const dd = deg + min / 60;
  return isNegative ? -dd : dd;
}

function dmsToDd(deg: number, min: number, sec: number, isNegative: boolean): number {
  const dd = deg + min / 60 + sec / 3600;
  return isNegative ? -dd : dd;
}

// --- Geographic coordinate field (DD / DDM / DMS) ---
interface CoordinateInputProps {
  label: string;
  value: string;
  onChange: (ddValue: string) => void;
  placeholder?: string;
  isLatitude: boolean;
  format: CoordFormat;
  style?: React.CSSProperties;
}

function CoordinateField({ label, value, onChange, placeholder, isLatitude, format, style }: CoordinateInputProps) {
  const dd = parseFloat(value);
  const isNeg = !isNaN(dd) && dd < 0;

  const [degVal, setDegVal] = useState('');
  const [minVal, setMinVal] = useState('');
  const [secVal, setSecVal] = useState('');

  useEffect(() => {
    if (!value || isNaN(parseFloat(value))) {
      setDegVal('');
      setMinVal('');
      setSecVal('');
      return;
    }
    const ddNum = parseFloat(value);
    if (format === 'DDM') {
      const { deg, min } = ddToDdm(ddNum);
      setDegVal(String(deg));
      setMinVal(String(min));
      setSecVal('');
    } else if (format === 'DMS') {
      const { deg, min, sec } = ddToDms(ddNum);
      setDegVal(String(deg));
      setMinVal(String(min));
      setSecVal(String(sec));
    }
  }, [format]);

  const dirPos = isLatitude ? 'N' : 'E';
  const dirNeg = isLatitude ? 'S' : 'W';

  if (format === 'DD') {
    return (
      <div>
        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#000' }}>
          {label}
        </label>
        <input
          type="number"
          step="0.000001"
          min={isLatitude ? -90 : -180}
          max={isLatitude ? 90 : 180}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || (isLatitude ? '51.234567' : '4.567890')}
          style={{ width: '100%', ...style }}
        />
      </div>
    );
  }

  if (format === 'DDM') {
    const dir = isNeg ? dirNeg : dirPos;
    const handleDegChange = (v: string) => {
      setDegVal(v);
      onChange(String(ddmToDd(parseFloat(v) || 0, parseFloat(minVal) || 0, dir === dirNeg)));
    };
    const handleMinChange = (v: string) => {
      setMinVal(v);
      onChange(String(ddmToDd(parseFloat(degVal) || 0, parseFloat(v) || 0, dir === dirNeg)));
    };

    return (
      <div>
        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#000' }}>
          {label}
        </label>
        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
          <input type="number" min="0" max={isLatitude ? 90 : 180} step="1" value={degVal} onChange={(e) => handleDegChange(e.target.value)} placeholder="51" style={{ width: '30%', ...style }} />
          <span style={{ fontSize: '0.85rem', color: '#000' }}>°</span>
          <input type="number" min="0" max="59.9999" step="0.0001" value={minVal} onChange={(e) => handleMinChange(e.target.value)} placeholder="14.0740" style={{ width: '40%', ...style }} />
          <span style={{ fontSize: '0.85rem', color: '#000' }}>'</span>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, minWidth: '1.2rem', color: '#000' }}>{dir}</span>
        </div>
      </div>
    );
  }

  // DMS
  const dir = isNeg ? dirNeg : dirPos;
  const recompute = (d: string, m: string, s: string) => {
    onChange(String(dmsToDd(parseFloat(d) || 0, parseFloat(m) || 0, parseFloat(s) || 0, dir === dirNeg)));
  };

  return (
    <div>
      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#000' }}>
        {label}
      </label>
      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
        <input type="number" min="0" max={isLatitude ? 90 : 180} step="1" value={degVal} onChange={(e) => { setDegVal(e.target.value); recompute(e.target.value, minVal, secVal); }} placeholder="51" style={{ width: '22%', ...style }} />
        <span style={{ fontSize: '0.85rem', color: '#000' }}>°</span>
        <input type="number" min="0" max="59" step="1" value={minVal} onChange={(e) => { setMinVal(e.target.value); recompute(degVal, e.target.value, secVal); }} placeholder="14" style={{ width: '22%', ...style }} />
        <span style={{ fontSize: '0.85rem', color: '#000' }}>'</span>
        <input type="number" min="0" max="59.999" step="0.001" value={secVal} onChange={(e) => { setSecVal(e.target.value); recompute(degVal, minVal, e.target.value); }} placeholder="2.640" style={{ width: '28%', ...style }} />
        <span style={{ fontSize: '0.85rem', color: '#000' }}>"</span>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, minWidth: '1.2rem', color: '#000' }}>{dir}</span>
      </div>
    </div>
  );
}

// --- Projected coordinate input (X/Y → lat/lon) ---
interface ProjectedCoordinateInputProps {
  latValue: string;
  lonValue: string;
  onLatChange: (v: string) => void;
  onLonChange: (v: string) => void;
  format: CoordFormat;
  style?: React.CSSProperties;
}

export function ProjectedCoordinateInput({ latValue, lonValue, onLatChange, onLonChange, format, style }: ProjectedCoordinateInputProps) {
  const [xVal, setXVal] = useState('');
  const [yVal, setYVal] = useState('');

  // Sync from DD lat/lon when switching to this projected format
  useEffect(() => {
    const lat = parseFloat(latValue);
    const lon = parseFloat(lonValue);
    if (!isNaN(lat) && !isNaN(lon)) {
      try {
        const [x, y] = proj4('EPSG:4326', format, [lon, lat]);
        setXVal(String(Math.round(x * 100) / 100));
        setYVal(String(Math.round(y * 100) / 100));
      } catch {
        setXVal('');
        setYVal('');
      }
    } else {
      setXVal('');
      setYVal('');
    }
  }, [format]);

  const convertAndPropagate = (x: number | null, y: number | null) => {
    if (x !== null && y !== null) {
      try {
        const [lon, lat] = proj4(format, 'EPSG:4326', [x, y]);
        onLonChange(String(Math.round(lon * 1000000) / 1000000));
        onLatChange(String(Math.round(lat * 1000000) / 1000000));
        return;
      } catch { /* invalid coords */ }
    }
    // Clear lat/lon when we can't convert yet (only one field filled)
    onLatChange('');
    onLonChange('');
  };

  const handleXChange = (v: string) => {
    setXVal(v);
    const x = parseFloat(v);
    const y = parseFloat(yVal);
    convertAndPropagate(isNaN(x) ? null : x, isNaN(y) ? null : y);
  };

  const handleYChange = (v: string) => {
    setYVal(v);
    const x = parseFloat(xVal);
    const y = parseFloat(v);
    convertAndPropagate(isNaN(x) ? null : x, isNaN(y) ? null : y);
  };

  const epsgLabel = FORMAT_LABELS[format] || format;

  return (
    <>
      <div>
        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#000' }}>
          X / Easting ({epsgLabel})
        </label>
        <input
          type="number"
          step="0.01"
          value={xVal}
          onChange={(e) => handleXChange(e.target.value)}
          placeholder={format.includes('31370') ? '150000' : format.includes('3812') ? '649328' : '500000'}
          style={{ width: '100%', ...style }}
        />
      </div>
      <div>
        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#000' }}>
          Y / Northing ({epsgLabel})
        </label>
        <input
          type="number"
          step="0.01"
          value={yVal}
          onChange={(e) => handleYChange(e.target.value)}
          placeholder={format.includes('31370') ? '170000' : format.includes('3812') ? '665262' : '5700000'}
          style={{ width: '100%', ...style }}
        />
      </div>
    </>
  );
}

// --- Format selector ---
interface CoordFormatSelectorProps {
  value: CoordFormat;
  onChange: (fmt: CoordFormat) => void;
}

export function CoordFormatSelector({ value, onChange }: CoordFormatSelectorProps) {
  return (
    <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
      {GEOGRAPHIC_FORMATS.map((fmt) => (
        <button
          key={fmt}
          type="button"
          onClick={() => onChange(fmt)}
          style={{
            padding: '0.25rem 0.5rem',
            fontSize: '0.7rem',
            fontWeight: value === fmt ? 700 : 400,
            backgroundColor: value === fmt ? '#0d6efd' : '#e9ecef',
            color: value === fmt ? '#fff' : '#495057',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
          }}
        >
          {FORMAT_LABELS[fmt]}
        </button>
      ))}
      <span style={{ borderLeft: '1px solid #ced4da', margin: '0 0.15rem' }} />
      {PROJECTED_FORMATS.map((fmt) => (
        <button
          key={fmt}
          type="button"
          onClick={() => onChange(fmt)}
          style={{
            padding: '0.25rem 0.5rem',
            fontSize: '0.7rem',
            fontWeight: value === fmt ? 700 : 400,
            backgroundColor: value === fmt ? '#198754' : '#e9ecef',
            color: value === fmt ? '#fff' : '#495057',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
          }}
        >
          {FORMAT_LABELS[fmt]}
        </button>
      ))}
    </div>
  );
}

export default CoordinateField;
