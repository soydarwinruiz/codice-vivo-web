# Códice vivo — web para iPhone (PWA) y escritorio para Windows

Biblia de estudio **100% local** que se instala en el iPhone desde Safari, sin App Store ni Mac.
Este repositorio contiene **solo el código** (sin contenido con derechos de autor).
La biblioteca (Biblias, notas de MacArthur, diccionario, oraciones…) se importa una vez desde un archivo privado
y queda guardada dentro del propio dispositivo.

## Instalación en el iPhone (iOS 16.4 o superior)
1. Abre la página de la app en **Safari**.
2. Toca **Compartir** → **Añadir a pantalla de inicio**.
3. Abre **Códice vivo desde el icono** (no desde Safari: guardan los datos por separado).
4. Descarga `biblioteca/codice-vivo-biblioteca.db.gz` de tu repositorio privado `biblia-estudio` y guárdalo en **Archivos**.
5. En la app, toca **Elegir archivo de la biblioteca** y selecciónalo.

Desde entonces funciona sin conexión.

## Funciones
Hoy (versículo, pasaje, lección, oración y preguntas del día), lector con 12 versiones, vista paralela, lectura continua,
selector libro → capítulo → versículo, búsqueda sin acentos, comparar versiones, resaltado de versículos y de palabras,
notas, temas, etiquetas, marcadores, notas e introducciones de MacArthur, diccionario bíblico, índice temático, lecciones,
editor de estudio (contexto, exégesis, hermenéutica, homilética), planes de lectura, progreso, logros, memorización,
lectura en voz alta y temas claro/oscuro/sepia.
El **respaldo JSON es compatible con la app de Android** en los dos sentidos.

### Compatibilidad con Android 1.5
- **Diario** (peticiones de oración con «respondida» y entradas de diario): se puede orar desde un versículo del lector (botón «Orar») o desde *Mis temas › Diario*.
- **Memorizar con SM-2**: cuatro respuestas (otra vez, difícil, bien, fácil) y modo **escribir de memoria**, con el mismo algoritmo que Android para que un versículo avance igual en los dos teléfonos.
- **Búsqueda**: frase exacta, en notas MacArthur y en tus notas, estudios y diario, con historial.
- La base de datos personal se actualiza sola (añade las columnas nuevas sin perder nada) y la importación ignora los campos que no conozca, así que un respaldo de una versión más nueva no hace fallar la restauración.
- Importante: los respaldos de Android 1.5 **no se pueden importar en la versión web anterior**; actualiza la web (se actualiza sola al abrirla con conexión) antes de restaurarlos.

## Versión de escritorio para Windows
Una app de escritorio al estilo de e-Sword / Logos, con la misma biblioteca y los mismos datos personales:

- **Varios paneles**: lista de libros y capítulos (con los capítulos leídos marcados) · Biblia · panel de estudio. Los paneles se pueden redimensionar u ocultar.
- **Biblias en paralelo**: hasta 4 versiones en columnas, alineadas versículo por versículo.
- **Panel de estudio sincronizado** con el versículo seleccionado: notas MacArthur, referencias cruzadas con su texto, comparar todas las versiones, diccionario, mis notas (editables ahí mismo) e introducción del libro.
- **Clic derecho** en un versículo: resaltar, nota, palabras, tema, etiqueta, marcador, copiar (en cualquier versión), estudiar, memorizar, orar.
- **Doble clic** en una palabra: la busca en el diccionario.
- **Teclado**: `Ctrl+G` ir a referencia (Jn 3:16, Ro 8…), `Ctrl+F` buscar, `←/→` capítulo, `↑/↓` versículo, `Mayús+clic` rango, `Ctrl+C` copiar, `Alt+←/→` atrás/adelante, `F1` todos los atajos.
- Menús de Windows (Archivo, Editar, Ir, Módulos, Ver, Ayuda), temas claro/oscuro/sepia y tamaño de letra.
- Todo lo demás de la app (Hoy, Estudio, Mis temas, Diario, Progreso, Ajustes…) se abre en el panel central.

Los datos se guardan con SQLite nativo en `%APPDATA%\Códice vivo` (`biblioteca.db` y `usuario.db`); *Archivo › Abrir carpeta de datos* la abre.
El **respaldo JSON** es el mismo que en iPhone y Android: *Archivo › Exportar/Importar respaldo*.

### Descargar e instalar
1. En GitHub: pestaña **Actions** › flujo **Windows** › la ejecución más reciente › artefacto **CodiceVivo-Windows**
   (o, si existe, la página **Releases**).
2. Ejecuta `CodiceVivo-Setup-x.y.z.exe` (instalador) o `CodiceVivo-Portable-x.y.z.exe` (sin instalar).
   El programa no está firmado digitalmente: si Windows SmartScreen avisa, pulsa *Más información › Ejecutar de todas formas*.
3. Al abrirlo por primera vez, elige el archivo `codice-vivo-biblioteca.db.gz` (o `.db`) de tu repositorio privado.

Para publicar una versión: sube una etiqueta, p. ej. `git tag v1.0.0 && git push origin v1.0.0`, y el flujo crea la Release con los dos `.exe`.

### Desarrollo de la versión de escritorio
```bash
npm install
npm run desktop       # compila la interfaz y abre la app (Electron)
npm run desktop:dev   # con recarga en caliente
npm run dist:win      # genera los .exe en release/ (en Windows; en Linux/macOS requiere Wine)
```
En el navegador, el diseño de escritorio también se usa automáticamente en pantallas anchas con ratón
(se puede elegir en *Ajustes › Diseño*).

## Desarrollo (web)
```bash
npm install
npm run dev      # servidor local
npm run build    # genera docs/ (publicado con GitHub Pages)
```
Tecnología: Preact + Vite, SQLite (WASM) sobre el almacenamiento privado del navegador (OPFS) en un Web Worker,
service worker para funcionar sin conexión. En Windows: Electron con SQLite nativo (`node:sqlite`) en el proceso principal.

## Publicar con GitHub Pages
Settings → Pages → *Deploy from a branch* → rama `main`, carpeta `/docs`.
