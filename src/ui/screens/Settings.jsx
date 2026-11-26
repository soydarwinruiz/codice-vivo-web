import { useState } from 'preact/hooks';
import * as C from '../../data/content.js';
import * as U from '../../data/user.js';
import { useSettings, updateSettings } from '../../data/settings.js';
import { call } from '../../db/client.js';
import { TopBar, Dialog, toast, nav } from '../components.jsx';

const THEMES = [['system', 'Sistema'], ['light', 'Claro'], ['dark', 'Oscuro'], ['sepia', 'Sepia']];

export function SettingsScreen() {
  const s = useSettings();
  const [pending, setPending] = useState(null);
  const [replace, setReplace] = useState(false);
  const Switch = ({ k, label }) => <div class="item" onClick={() => updateSettings({ [k]: !s[k] })}><div class="grow">{label}</div><input type="checkbox" checked={s[k]} style="width:22px;height:22px" /></div>;
  async function exportBackup() {
    const json = await U.exportJson();
    const name = `codice-vivo-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: name }).catch(() => {}); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; a.click();
  }
  return (
    <div>
      <TopBar title="Ajustes" />
      <div class="section-h">Apariencia</div>
      <div class="chips">{THEMES.map(([k, l]) => <button class={`chip ${s.theme === k ? 'on' : ''}`} onClick={() => updateSettings({ theme: k })}>{l}</button>)}</div>
      <div class="page">
        <label class="field"><span>Tamaño de letra: {s.fontSize}</span><input type="range" min="14" max="30" value={s.fontSize} style="width:100%" onInput={(e) => updateSettings({ fontSize: +e.target.value })} /></label>
        <label class="field"><span>Interlineado: {s.lineHeight.toFixed(2)}</span><input type="range" min="1.2" max="2" step="0.05" value={s.lineHeight} style="width:100%" onInput={(e) => updateSettings({ lineHeight: +e.target.value })} /></label>
        <div class="card serif" style={{ margin: 0, fontSize: `${s.fontSize}px`, lineHeight: s.lineHeight }}>En el principio era el Verbo, y el Verbo era con Dios, y el Verbo era Dios.</div>
        <label class="field"><span>Velocidad de lectura en voz alta: {s.speechRate.toFixed(1)}×</span><input type="range" min="0.6" max="1.4" step="0.1" value={s.speechRate} style="width:100%" onInput={(e) => updateSettings({ speechRate: +e.target.value })} /></label>
      </div>
      <div class="section-h">Lectura</div>
      <div class="chips" style="flex-wrap:wrap">{C.versions.map((v) => <button class={`chip ${s.version === v.id ? 'on' : ''}`} onClick={() => updateSettings({ version: v.id })}>{v.id}</button>)}</div>
      <div class="list">
        <Switch k="continuous" label="Lectura continua (capítulos encadenados)" />
        <Switch k="showHeadings" label="Mostrar títulos de sección" />
        <Switch k="showVerseNumbers" label="Mostrar números de versículo" />
        <Switch k="showNoteMarkers" label="Indicar notas de estudio MacArthur" />
      </div>
      <div class="section-h">Respaldo de datos personales</div>
      <p class="page small" style="margin:0">Tus resaltados, notas, temas, estudios y progreso se guardan solo en este dispositivo. El respaldo es compatible con la app de Android: puedes pasar tus datos de un teléfono a otro.</p>
      <div class="row page">
        <button class="btn" onClick={exportBackup}>Exportar</button>
        <label class="btn outline">Importar<input type="file" accept=".json,application/json" style="display:none" onChange={(e) => setPending(e.target.files?.[0])} /></label>
      </div>
      <div class="section-h">Biblioteca</div>
      <div class="page"><button class="btn outline" onClick={() => setReplace(true)}>Reemplazar biblioteca (nueva versión)</button></div>
      <div class="section-h">Acerca de</div>
      <p class="page small" style="white-space:pre-line">{`Códice vivo — Biblia de estudio\nCreada por Danruz.\n\nBiblia de estudio 100% local. Todo el contenido y tus datos permanecen en este dispositivo.\n\nContenido de estudio: Biblia de Estudio MacArthur (© Editorial Portavoz / Thomas Nelson), para uso personal.\n\nTextos bíblicos:\n${C.versions.map((v) => `• ${v.id}: ${v.copyright || v.name}`).join('\n')}`}</p>
      {pending && <Dialog title="¿Restaurar respaldo?" onClose={() => setPending(null)} actions={<><button class="btn text" onClick={() => setPending(null)}>Cancelar</button>
        <button class="btn text" onClick={async () => { const f = pending; setPending(null); try { await U.importJson(await f.text()); toast('Respaldo restaurado'); } catch (e) { toast('Archivo no válido'); } }}>Restaurar</button></>}>
        <p class="small">Se reemplazarán todos tus datos personales actuales por los del archivo.</p></Dialog>}
      {replace && <Dialog title="¿Reemplazar la biblioteca?" onClose={() => setReplace(false)} actions={<><button class="btn text" onClick={() => setReplace(false)}>Cancelar</button>
        <button class="btn text" onClick={async () => { await call('deleteLibrary'); nav('/setup', null, true); location.reload(); }}>Continuar</button></>}>
        <p class="small">Se borrará la biblioteca actual y podrás elegir un archivo nuevo. Tus datos personales no se tocan.</p></Dialog>}
    </div>
  );
}
