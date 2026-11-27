import { useState } from 'preact/hooks';
import { call, desktop } from '../../db/client.js';
import { Progress } from '../components.jsx';

/** Primera vez: importar la biblioteca (archivo privado) al almacenamiento local del dispositivo. */
export function Setup({ onDone }) {
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  async function pick(e) {
    const file = e.target.files?.[0]; if (!file) return;
    await load({ file });
  }
  async function pickDesktop() {
    const path = await desktop.pickLibrary(); if (path) await load({ path });
  }
  async function load(args) {
    setError(null); setProgress(0);
    try {
      if (!desktop && navigator.storage?.persist) await navigator.storage.persist().catch(() => {});
      await call('importLibrary', args, (p) => setProgress(p));
      setProgress(1); onDone();
    } catch (err) { setError(String(err.message || err)); setProgress(null); }
  }
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  if (desktop) return (
    <div class="setup">
      <img src="icon-192.png" width="72" height="72" style="border-radius:18px" alt="" />
      <h1 class="serif" style="margin-bottom:4px">Códice vivo</h1>
      <p class="muted" style="margin-top:0">Biblia de estudio 100% local para Windows</p>
      <div class="card">
        <h3>Preparar la biblioteca (solo la primera vez)</h3>
        <ol class="small">
          <li>Descarga el archivo <b>codice-vivo-biblioteca.db.gz</b> desde tu repositorio privado <i>biblia-estudio</i> (carpeta <b>biblioteca</b>).</li>
          <li>Pulsa el botón y elige ese archivo (también sirve el <b>.db</b> ya descomprimido).</li>
          <li>Espera a que termine. Después la app funciona sin Internet.</li>
        </ol>
        {progress === null ? <button class="btn block" onClick={pickDesktop}>Elegir archivo de la biblioteca…</button>
          : <div><p class="small">Preparando la biblioteca… {Math.round(progress * 100)} %</p><Progress value={progress} /></div>}
        {error && <p style="color:var(--danger)" class="small">{error}</p>}
      </div>
      <p class="small muted">La biblioteca y tus datos personales se guardan solo en este equipo. Puedes traer tus resaltados y notas del teléfono con el respaldo JSON (Archivo › Importar respaldo).</p>
    </div>
  );
  return (
    <div class="setup">
      <img src="icon-192.png" width="72" height="72" style="border-radius:18px" alt="" />
      <h1 class="serif" style="margin-bottom:4px">Códice vivo</h1>
      <p class="muted" style="margin-top:0">Biblia de estudio 100% local</p>
      {ios && !standalone && (
        <div class="card tint">
          <h3>Paso 1: instálala en tu iPhone</h3>
          <p class="small" style="margin:0">Toca <b>Compartir</b> (el cuadrado con la flecha) → <b>Añadir a pantalla de inicio</b>. Luego <b>ábrela desde ese icono</b> y prepara allí la biblioteca: Safari y la app instalada guardan los datos por separado.</p>
        </div>
      )}
      <div class="card">
        <h3>Preparar la biblioteca (solo la primera vez)</h3>
        <ol class="small">
          <li>Descarga el archivo <b>codice-vivo-biblioteca.db.gz</b> desde tu repositorio privado <i>biblia-estudio</i> (carpeta <b>biblioteca</b>) y guárdalo en <b>Archivos</b>.</li>
          <li>Toca el botón y elige ese archivo.</li>
          <li>Espera a que termine. Después la app funciona sin Internet.</li>
        </ol>
        {progress === null ? (
          <label class="btn block" style="display:block;text-align:center">
            Elegir archivo de la biblioteca
            <input type="file" accept=".gz,.db,.bin,application/gzip,application/octet-stream" style="display:none" onChange={pick} />
          </label>
        ) : (
          <div><p class="small">Preparando la biblioteca… {Math.round(progress * 100)} %</p><Progress value={progress} /></div>
        )}
        {error && <p style="color:var(--danger)" class="small">{error}</p>}
      </div>
      <p class="small muted">Para instalarla en tu iPhone: en Safari toca <b>Compartir</b> → <b>Añadir a pantalla de inicio</b>. Ábrela siempre desde ese icono para que tus datos se conserven.</p>
    </div>
  );
}
