// Renders one color control per entry in theme.json.colors.
// Shows palette swatches from the background layer image when available.

export default function ColorsPanel({ colors, customizations, palette, onChange }) {
  if (!colors || !Object.keys(colors).length) {
    return <p style={s.empty}>No colors defined in this template.</p>;
  }

  return (
    <div style={s.root}>
      {palette.length > 0 && (
        <div style={s.paletteRow}>
          <p style={s.paletteLabel}>From image</p>
          <div style={s.swatches}>
            {palette.map((hex) => (
              <PaletteSwatch key={hex} hex={hex} colors={colors} customizations={customizations} onChange={onChange} />
            ))}
          </div>
        </div>
      )}

      {Object.entries(colors).map(([key, def]) => {
        const value = customizations[def.cssVar] ?? def.default;
        return (
          <ColorControl
            key={key}
            def={def}
            value={value}
            palette={def.canUseFromPalette ? palette : []}
            onChange={(v) => onChange(def.cssVar, v)}
          />
        );
      })}
    </div>
  );
}

function PaletteSwatch({ hex, colors, customizations, onChange }) {
  // Clicking a swatch applies to all canUseFromPalette color fields (shows a popover to pick which)
  // Simplified: just show the swatch and on click apply to the first canUseFromPalette color
  function apply() {
    const targets = Object.values(colors).filter((c) => c.canUseFromPalette);
    if (targets.length === 1) {
      onChange(targets[0].cssVar, hex);
    }
  }
  return (
    <button
      style={{ ...s.swatch, background: hex }}
      title={`Apply ${hex}`}
      onClick={apply}
    />
  );
}

function ColorControl({ def, value, palette, onChange }) {
  return (
    <div style={s.control}>
      <label style={s.label}>{def.label}</label>
      <div style={s.inputRow}>
        <input
          type="color"
          value={toHex(value)}
          onChange={(e) => onChange(e.target.value)}
          style={s.colorPicker}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={s.hexInput}
          maxLength={7}
          spellCheck={false}
        />
      </div>
      {palette.length > 0 && (
        <div style={s.paletteMini}>
          {palette.map((hex) => (
            <button
              key={hex}
              style={{ ...s.swatchMini, background: hex }}
              onClick={() => onChange(hex)}
              title={hex}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function toHex(val) {
  if (!val) return '#000000';
  if (/^#[0-9a-f]{6}$/i.test(val)) return val;
  if (/^#[0-9a-f]{3}$/i.test(val)) {
    const [, r, g, b] = val.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return '#000000';
}

const s = {
  root: { display: 'flex', flexDirection: 'column', gap: 20 },
  empty: { fontSize: 12, color: '#aaa', fontStyle: 'italic' },
  paletteRow: { marginBottom: 4 },
  paletteLabel: { fontSize: 11, color: '#999', marginBottom: 6 },
  swatches: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 4,
    border: '1px solid rgba(0,0,0,0.12)',
    cursor: 'pointer',
    padding: 0,
  },
  control: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, fontWeight: 600, color: '#444' },
  inputRow: { display: 'flex', gap: 8, alignItems: 'center' },
  colorPicker: {
    width: 36,
    height: 32,
    border: '1px solid #d0cdc6',
    borderRadius: 4,
    padding: 2,
    cursor: 'pointer',
  },
  hexInput: {
    flex: 1,
    fontSize: 13,
    padding: '5px 10px',
    border: '1px solid #d0cdc6',
    borderRadius: 4,
    fontFamily: 'monospace',
    background: '#fff',
  },
  paletteMini: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  swatchMini: {
    width: 20,
    height: 20,
    borderRadius: 3,
    border: '1px solid rgba(0,0,0,0.1)',
    cursor: 'pointer',
    padding: 0,
  },
};
