// Renders toggles and sliders per entry in theme.json.components

export default function ComponentsPanel({ components, customizations, onChange }) {
  if (!components || !Object.keys(components).length) {
    return <p style={s.empty}>No components defined in this template.</p>;
  }

  return (
    <div style={s.root}>
      {Object.entries(components).map(([key, def]) => (
        <ComponentControl
          key={key}
          def={def}
          customizations={customizations}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

function ComponentControl({ def, customizations, onChange }) {
  // For toggleable components, we track enabled state via a special key
  // In practice, we disable by setting the relevant CSS var to 0/none

  return (
    <div style={s.section}>
      <div style={s.sectionHeader}>
        <span style={s.sectionLabel}>{def.label}</span>
      </div>

      {def.settings && Object.entries(def.settings).map(([settingKey, setting]) => {
        const rawVal = customizations[setting.cssVar] ?? (setting.default + (setting.unit || ''));
        const numVal = parseInt(rawVal, 10);
        const isNum = !isNaN(numVal);

        return (
          <div key={settingKey} style={s.control}>
            <div style={s.sliderHeader}>
              <label style={s.label}>{setting.label}</label>
              <span style={s.value}>{isNum ? numVal : rawVal}{setting.unit}</span>
            </div>
            {isNum ? (
              <input
                type="range"
                min={setting.min ?? 0}
                max={setting.max ?? 100}
                value={numVal}
                onChange={(e) => onChange(setting.cssVar, e.target.value + (setting.unit || ''))}
                style={s.slider}
              />
            ) : (
              <input
                type="text"
                value={rawVal}
                onChange={(e) => onChange(setting.cssVar, e.target.value)}
                style={s.textInput}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

const s = {
  root: { display: 'flex', flexDirection: 'column', gap: 20 },
  empty: { fontSize: 12, color: '#aaa', fontStyle: 'italic' },
  section: { paddingBottom: 16, borderBottom: '1px solid #ece9e2' },
  sectionHeader: { marginBottom: 12 },
  sectionLabel: { fontSize: 13, fontWeight: 600 },
  control: { marginBottom: 14 },
  sliderHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  label: { fontSize: 12, fontWeight: 500, color: '#555' },
  value: { fontSize: 12, color: '#888', fontVariantNumeric: 'tabular-nums' },
  slider: { width: '100%', cursor: 'pointer' },
  textInput: {
    width: '100%',
    fontSize: 13,
    padding: '5px 10px',
    border: '1px solid #d0cdc6',
    borderRadius: 4,
    background: '#fff',
  },
};
