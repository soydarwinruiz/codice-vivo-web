# Códice vivo — versión web para iPhone (PWA)

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
El **respaldo JSON es compatible con la app de Android**.

## Desarrollo
```bash
npm install
npm run dev      # servidor local
npm run build    # genera docs/ (publicado con GitHub Pages)
```
Tecnología: Preact + Vite, SQLite (WASM) sobre el almacenamiento privado del navegador (OPFS) en un Web Worker,
service worker para funcionar sin conexión.

## Publicar con GitHub Pages
Settings → Pages → *Deploy from a branch* → rama `main`, carpeta `/docs`.
