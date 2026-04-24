// Font pair dropdown + size sliders, all driven by theme.json.typography

export default function TypographyPanel({ typography, customizations, onChange }) {
  if (!typography) return <p style={s.empty}>No typography options defined in this template.</p>;

  const { fontPair, sizes } = typography;

  // Determine currently selected font pair name
  let selectedPairName = '';
  if (fontPair) {
    const { heading, body } = fontPair.cssVars;
    const currentHeading = customizations[heading];
    const currentBody = customizations[body];
    const match = fontPair.options.find(
      (o) =>
        (currentHeading || '').includes(o.heading) &&
        (currentBody || '').includes(o.body)
    );
    selectedPairName = match ? match.name : (fontPair.options[0]?.name || '');
  }

  function handleFontPairChange(pairName) {
    const pair = fontPair.options.find((o) => o.name === pairName);
    if (!pair) return;
    onChange({
      [fontPair.cssVars.heading]: `'${pair.heading}', serif`,
      [fontPair.cssVars.body]: `'${pair.body}', sans-serif`,
    });
  }

  return (
    <div style={s.root}>
      {fontPair && (
        <div style={s.control}>
          <label style={s.label}>{fontPair.label}</label>
          <select
            value={selectedPairName}
            onChange={(e) => handleFontPairChange(e.target.value)}
            style={s.select}
          >
            {fontPair.options.map((o) => (
              <option key={o.name} value={o.name}>{o.name}</option>
            ))}
          </select>
          {/* Preview */}
          <div style={s.fontPreview}>
            <span style={{ fontFamily: getHeadingFont(fontPair, selectedPairName) }}>
              Heading
            </span>
            <span style={{ fontFamily: getBodyFont(fontPair, selectedPairName), fontSize: 13 }}>
              {' '}/ Body
            </span>
          </div>
        </div>
      )}

      {sizes && Object.entries(sizes).map(([key, def]) => {
        const rawVal = customizations[def.cssVar] ?? def.default;
        const numVal = parseInt(rawVal, 10) || def.min || 0;
        return (
          <div key={key} style={s.control}>
            <div style={s.sliderHeader}>
              <label style={s.label}>{def.label}</label>
              <span style={s.sliderValue}>{numVal}{def.unit}</span>
            </div>
            <input
              type="range"
              min={def.min}
              max={def.max}
              value={numVal}
              onChange={(e) => onChange(def.cssVar, e.target.value + def.unit)}
              style={s.slider}
            />
          </div>
        );
      })}
    </div>
  );
}

function getHeadingFont(fontPair, pairName) {
  const pair = fontPair.options.find((o) => o.name === pairName);
  return pair ? `'${pair.heading}', serif` : 'serif';
}

function getBodyFont(fontPair, pairName) {
  const pair = fontPair.options.find((o) => o.name === pairName);
  return pair ? `'${pair.body}', sans-serif` : 'sans-serif';
}

const s = {
  root: { display: 'flex', flexDirection: 'column', gap: 22 },
  empty: { fontSize: 12, color: '#aaa', fontStyle: 'italic' },
  control: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, fontWeight: 600, color: '#444' },
  select: {
    fontSize: 13,
    padding: '6px 10px',
    border: '1px solid #d0cdc6',
    borderRadius: 4,
    background: '#fff',
  },
  fontPreview: {
    marginTop: 4,
    fontSize: 15,
    color: '#555',
  },
  sliderHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
  sliderValue: { fontSize: 12, color: '#888', fontVariantNumeric: 'tabular-nums' },
  slider: { width: '100%', cursor: 'pointer' },
};
