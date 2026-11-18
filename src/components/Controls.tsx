import { useId, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { DRUG_DEFS, INPUT_DEFS, TOGGLE_DEFS, defaultInputs, type DrugKey, type InputKey, type ModelInputs } from '../model';

const DEFAULTS = defaultInputs();
const decimalsFor = (step: number) => (step >= 1 ? 0 : Math.max(0, Math.ceil(-Math.log10(step) - 1e-9)));

/** Shorter names for the compact panel; full names stay in the info text. */
const SHORT: Partial<Record<InputKey, string>> = {
  map: 'Mean arterial pressure',
  afferentMult: 'Afferent arteriole tone',
  efferentMult: 'Efferent arteriole tone',
  bowmanPressure: "Bowman's space pressure",
  nephronsPerKidney: 'Nephrons per kidney',
  plasmaProtein: 'Plasma protein',
  creatinineProduction: 'Creatinine production',
  proteinIntake: 'Protein intake',
  fluidBalance: 'Net fluid balance',
  adh: 'ADH (water hormone)',
  angiotensinII: 'Angiotensin II',
  aldosterone: 'Aldosterone',
  anp: 'ANP (natriuretic peptide)',
  sodiumIntake: 'Sodium intake',
  age: 'Age',
};

/** Volume status is a simulation STATE, not an input, so it gets its own control. */
function VolumeSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const id = useId();
  const infoId = useId();
  const [info, setInfo] = useState(false);
  const changed = Math.abs(value) > 0.5;
  const label = value < -12 ? 'markedly depleted' : value < -4 ? 'depleted' : value > 8 ? 'overloaded' : value > 3 ? 'expanded' : 'euvolaemic';
  const fill = ((value + 30) / 60) * 100;
  return (
    <div className="py-1.5">
      <div className="flex items-center gap-1.5">
        <label htmlFor={id} className="min-w-0 flex-1 truncate text-[13px] text-slate-700">
          Extracellular volume
        </label>
        {changed && (
          <button type="button" onClick={() => onChange(0)} className="text-[11px] text-sky-700 hover:underline" aria-label="Reset extracellular volume">
            reset
          </button>
        )}
        <output htmlFor={id} className={`text-[13px] tabular-nums ${changed ? 'font-semibold text-sky-800' : 'text-slate-600'}`}>
          {value > 0 ? '+' : ''}
          {value.toFixed(0)}%
        </output>
        <InfoToggle open={info} onClick={() => setInfo((o) => !o)} label="extracellular volume" controls={infoId} />
      </div>
      <div className="relative">
        <input
          id={id}
          type="range"
          min={-30}
          max={30}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-valuetext={`${value > 0 ? '+' : ''}${value.toFixed(0)} percent, ${label}`}
          className="nl-range w-full"
          style={{ '--fill': `${fill}%` } as CSSProperties}
        />
        <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-1/2 h-2.5 w-0.5 -translate-y-1/2 rounded bg-slate-400/70" />
      </div>
      <p className="text-[11px] text-slate-500">
        {label}
        {' · '}
        sodium balance moves this over simulated days
      </p>
      {info && (
        <Info
          id={infoId}
          text="Extracellular fluid volume relative to normal. With volume-linked hormones on, this sets mean arterial pressure, angiotensin II, aldosterone, ADH, ANP and sympathetic afferent tone. It is a simulation state: it also drifts on its own until sodium excretion matches sodium intake."
          source="Directions are standard physiology; the gains are ILLUSTRATIVE (see MODEL.md)."
        />
      )}
    </div>
  );
}

/**
 * Venous congestion is set qualitatively. The renal venous pressure behind it is not
 * something anyone measures at the bedside, and the teaching point is the direction and
 * its downstream effect, so the mmHg value stays inside the model.
 */
const CONGESTION_LEVELS: { label: string; pressure: number; note: string }[] = [
  { label: 'None', pressure: 5, note: 'Normal venous drainage.' },
  { label: 'Mild', pressure: 12, note: 'Raised venous pressure begins to push back on filtration.' },
  { label: 'Moderate', pressure: 20, note: 'Congestion is now transmitted to the renal interstitium and Bowman\'s space.' },
  { label: 'Severe', pressure: 28, note: 'Marked congestion, as in decompensated right heart failure: filtration falls despite a preserved blood pressure.' },
];

function CongestionControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const groupId = useId();
  const infoId = useId();
  const [info, setInfo] = useState(false);
  const idx = CONGESTION_LEVELS.reduce((best, l, i) => (Math.abs(l.pressure - value) < Math.abs(CONGESTION_LEVELS[best]!.pressure - value) ? i : best), 0);
  const level = CONGESTION_LEVELS[idx]!;
  return (
    <div className="py-1.5">
      <div className="flex items-center gap-1.5">
        <span id={groupId} className="min-w-0 flex-1 text-[13px] text-slate-700">
          Venous congestion
        </span>
        {idx > 0 && (
          <button type="button" onClick={() => onChange(CONGESTION_LEVELS[0]!.pressure)} className="text-[11px] text-sky-700 hover:underline" aria-label="Reset venous congestion">
            reset
          </button>
        )}
        <InfoToggle open={info} onClick={() => setInfo((o) => !o)} label="venous congestion" controls={infoId} />
      </div>
      <div role="radiogroup" aria-labelledby={groupId} className="mt-1 inline-flex rounded-full bg-slate-100 p-0.5">
        {CONGESTION_LEVELS.map((l, i) => (
          <button
            key={l.label}
            type="button"
            role="radio"
            aria-checked={i === idx}
            onClick={() => onChange(l.pressure)}
            className={`rounded-full px-2.5 py-0.5 text-xs focus-visible:outline-2 focus-visible:outline-sky-600 ${i === idx ? 'bg-white font-semibold text-slate-900 shadow-sm' : 'text-slate-600'}`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-slate-500">{level.note}</p>
      {info && (
        <Info
          id={infoId}
          text="Back-pressure from the venous side. It slows renal blood flow and, more importantly, raises the pressure in the renal interstitium and Bowman's space, which opposes filtration. This is why GFR falls in congestive heart failure even when blood pressure is adequate, and why removing fluid can improve it."
          source="Direction is supported by classic isolated-kidney work on venous pressure and by cardiorenal physiology. MODEL CHOICE: how strongly congestion is transmitted to Bowman's space, and the pressure behind each level."
        />
      )}
    </div>
  );
}

function DrugRow({ k, inputs, setInputs }: { k: DrugKey; inputs: ModelInputs; setInputs: (p: Partial<ModelInputs>) => void }) {
  const d = DRUG_DEFS[k];
  const def = INPUT_DEFS[d.dose];
  const on = inputs[k];
  const lblId = useId();
  const infoId = useId();
  const doseId = useId();
  const [open, setOpen] = useState(false);
  const doseValue = inputs[d.dose] as number;
  return (
    <div className="border-b border-slate-100 py-1.5 last:border-b-0">
      <div className="flex items-center gap-1.5">
        <span className="min-w-0 flex-1" id={lblId}>
          <span className="text-[13px] text-slate-700">{d.name}</span>
          <span className="block text-[11px] text-slate-500">{d.site}</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby={lblId}
          onClick={() => setInputs({ [k]: !on })}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${on ? 'bg-sky-600' : 'bg-slate-300'}`}
        >
          <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : ''}`} />
        </button>
        <InfoToggle open={open} onClick={() => setOpen((o) => !o)} label={d.name} controls={infoId} />
      </div>
      {on && (
        <div className="mt-1 flex items-center gap-2">
          <label htmlFor={doseId} className="text-[11px] text-slate-500">
            Dose
          </label>
          <input
            id={doseId}
            type="range"
            min={def.min}
            max={def.max}
            step={def.step}
            value={doseValue}
            onChange={(e) => setInputs({ [d.dose]: Number(e.target.value) })}
            aria-valuetext={`${doseValue.toFixed(2)} times standard`}
            className="nl-range flex-1"
            style={{ '--fill': `${((doseValue - def.min) / (def.max - def.min)) * 100}%` } as CSSProperties}
          />
          <output htmlFor={doseId} className="w-12 text-right text-[11px] tabular-nums text-slate-600">
            ×{doseValue.toFixed(2)}
          </output>
        </div>
      )}
      {open && <Info id={infoId} text={d.mechanism} source={d.source} />}
    </div>
  );
}

function Info({ text, source, id }: { text: string; source: string; id: string }) {
  return (
    <div id={id} className="mt-1 rounded-lg bg-slate-50/90 p-2 text-[11px] leading-snug text-slate-600">
      <p>{text}</p>
      <p className="mt-1 text-slate-500">
        <span className="font-semibold">Source:</span> {source}
      </p>
    </div>
  );
}

function InfoToggle({ open, onClick, label, controls }: { open: boolean; onClick: () => void; label: string; controls: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-controls={controls}
      aria-label={`About ${label}`}
      className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-slate-400 ring-1 ring-slate-300 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-sky-600"
    >
      i
    </button>
  );
}

function Slider({ k, value, onChange }: { k: InputKey; value: number; onChange: (v: number) => void }) {
  const def = INPUT_DEFS[k];
  const id = useId();
  const infoId = useId();
  const [info, setInfo] = useState(false);
  const d = decimalsFor(def.step);
  const isMult = def.unit.startsWith('×');
  const shown = `${isMult ? '×' : ''}${value.toFixed(d)}${isMult ? '' : def.unit === 'million' ? ' M' : ` ${def.unit}`}`;
  const changed = Math.abs(value - DEFAULTS[k]) > def.step / 2;
  const name = SHORT[k] ?? def.name;
  const fill = ((value - def.min) / (def.max - def.min)) * 100;
  const defPos = ((DEFAULTS[k] - def.min) / (def.max - def.min)) * 100;
  return (
    <div className="py-1.5">
      <div className="flex items-center gap-1.5">
        <label htmlFor={id} className="min-w-0 flex-1 truncate text-[13px] text-slate-700">
          {name}
        </label>
        {changed && (
          <button type="button" onClick={() => onChange(DEFAULTS[k])} className="text-[11px] text-sky-700 hover:underline" aria-label={`Reset ${name}`}>
            reset
          </button>
        )}
        <output htmlFor={id} className={`text-[13px] tabular-nums ${changed ? 'font-semibold text-sky-800' : 'text-slate-600'}`}>
          {shown}
        </output>
        <InfoToggle open={info} onClick={() => setInfo((o) => !o)} label={name} controls={infoId} />
      </div>
      <div className="relative">
        <input
          id={id}
          type="range"
          min={def.min}
          max={def.max}
          step={def.step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-valuetext={isMult ? `${shown} ${def.unit.slice(2)}` : shown}
          className="nl-range w-full"
          style={{ '--fill': `${fill}%` } as CSSProperties}
        />
        {/* healthy-baseline tick */}
        <span aria-hidden="true" className="pointer-events-none absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 rounded bg-slate-400/70" style={{ left: `calc(${defPos}% + ${(0.5 - defPos / 100) * 16}px)` }} />
      </div>
      {info && <Info id={infoId} text={def.description} source={def.source} />}
    </div>
  );
}

function Switch({ label, checked, onChange, info }: { label: string; checked: boolean; onChange: (v: boolean) => void; info: { description: string; source: string } }) {
  const [open, setOpen] = useState(false);
  const lblId = useId();
  const infoId = useId();
  return (
    <div className="py-1.5">
      <div className="flex items-center gap-1.5">
        <span className="min-w-0 flex-1 text-[13px] text-slate-700" id={lblId}>
          {label}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby={lblId}
          onClick={() => onChange(!checked)}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${checked ? 'bg-sky-600' : 'bg-slate-300'}`}
        >
          <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
        </button>
        <InfoToggle open={open} onClick={() => setOpen((o) => !o)} label={label} controls={infoId} />
      </div>
      {open && <Info id={infoId} text={info.description} source={info.source} />}
    </div>
  );
}

const TABS = [
  { id: 'drugs', label: 'Drugs' },
  { id: 'hormones', label: 'Hormones' },
  { id: 'haemo', label: 'Flow' },
  { id: 'labs', label: 'Intake' },
  { id: 'patient', label: 'More' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export function Controls({
  inputs,
  setInputs,
  volumePercent,
  setVolumePercent,
}: {
  inputs: ModelInputs;
  setInputs: (p: Partial<ModelInputs>) => void;
  volumePercent: number;
  setVolumePercent: (v: number) => void;
}) {
  const [tab, setTab] = useState<Tab>('haemo');
  // 'haemo' stays the landing tab: it holds volume and pressure, which most runs start from.
  const base = useId();
  const sexName = useId();
  const s = (k: InputKey) => <Slider key={k} k={k} value={inputs[k]} onChange={(v) => setInputs({ [k]: v })} />;

  const onKey = (e: KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]!;
      setTab(n.id);
      document.getElementById(`${base}-tab-${n.id}`)?.focus();
      e.preventDefault();
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" aria-label="Parameter groups" onKeyDown={onKey} className="-mx-1 flex flex-wrap gap-1 px-1 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`${base}-tab-${t.id}`}
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`${base}-panel`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-sky-600 ${
              tab === t.id ? 'bg-slate-900 text-white' : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div id={`${base}-panel`} role="tabpanel" aria-labelledby={`${base}-tab-${tab}`} className="nl-scroll min-h-0 flex-1 overflow-y-auto pr-1">
        {tab === 'haemo' && (
          <>
            <VolumeSlider value={volumePercent} onChange={setVolumePercent} />
            {s('map')}
            {s('afferentMult')}
            {s('efferentMult')}
            {s('bowmanPressure')}
            <CongestionControl value={inputs.venousPressure} onChange={(v) => setInputs({ venousPressure: v })} />
            {s('nephronsPerKidney')}
            <Switch label="Autoregulation" checked={inputs.autoregulation} onChange={(v) => setInputs({ autoregulation: v })} info={TOGGLE_DEFS.autoregulation} />
          </>
        )}
        {tab === 'labs' && (
          <>
            {s('fluidBalance')}
            {s('sodiumIntake')}
            {s('proteinIntake')}
            <p className="mt-2 text-xs text-slate-500">
              Fluid balance is what the patient gains or loses outside the kidney — drip, drink, vomiting, diarrhoea or bleeding. Sodium holds
              that fluid in the body; protein is what becomes urea.
            </p>
          </>
        )}
        {tab === 'hormones' && (
          <>
            <Switch label="Volume-linked hormones" checked={inputs.volumeLinked} onChange={(v) => setInputs({ volumeLinked: v })} info={TOGGLE_DEFS.volumeLinked} />
            {s('angiotensinII')}
            {s('aldosterone')}
            {s('adh')}
            {s('anp')}
            <p className="mt-2 text-xs text-slate-500">
              {inputs.volumeLinked
                ? 'These sliders multiply the levels that extracellular volume already sets, so moving volume moves them too.'
                : 'Open loop: these levels are exactly what you set here, and volume has no effect on them.'}
            </p>
          </>
        )}
        {tab === 'drugs' && (
          <div className="pt-1">
            {(['acei', 'nsaid', 'sglt2', 'loopDiuretic', 'thiazide', 'mra'] as DrugKey[]).map((k) => (
              <DrugRow key={k} k={k} inputs={inputs} setInputs={setInputs} />
            ))}
            <p className="pt-2 text-xs text-slate-500">Tap the i for each drug's mechanism. Effects are illustrative in size, not dose-accurate.</p>
          </div>
        )}
        {tab === 'patient' && (
          <>
            <p className="pb-1 text-xs text-slate-500">Less commonly changed settings, kept out of the way.</p>
            {s('plasmaProtein')}
            {s('creatinineProduction')}
            <Switch label="Compensatory hyperfiltration" checked={inputs.compensation} onChange={(v) => setInputs({ compensation: v })} info={TOGGLE_DEFS.compensation} />
            <Switch label="Tubular creatinine secretion" checked={inputs.creatinineSecretion} onChange={(v) => setInputs({ creatinineSecretion: v })} info={TOGGLE_DEFS.creatinineSecretion} />
            {s('age')}
            <fieldset className="py-1.5">
              <legend className="text-[13px] text-slate-700">Sex</legend>
              <div className="mt-1 inline-flex rounded-full bg-slate-100 p-0.5">
                {(['male', 'female'] as const).map((v) => (
                  <label key={v} className={`cursor-pointer rounded-full px-3 py-0.5 text-xs has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sky-600 ${inputs.sex === v ? 'bg-white font-semibold text-slate-900 shadow-sm' : 'text-slate-600'}`}>
                    <input type="radio" name={sexName} value={v} checked={inputs.sex === v} onChange={() => setInputs({ sex: v })} className="sr-only" />
                    {v === 'male' ? 'Male' : 'Female'}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="text-xs text-slate-500">{TOGGLE_DEFS.sex.description}</p>
          </>
        )}
      </div>
    </div>
  );
}
