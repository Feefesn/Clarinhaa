/*
  clarinha-local-storage.js
  ---------------------------------------------------------
  Faz o front-end do "Clarinha's Personal" funcionar SEM
  backend/servidor local. Intercepta todas as chamadas
  fetch() feitas para API_BASE_URL (http://localhost:5000)
  e responde usando dados salvos no localStorage do navegador.

  Como usar:
  1. Coloque este arquivo na mesma pasta do seu .html
  2. No .html, adicione ANTES da tag <script> principal:
     <script src="clarinha-local-storage.js"></script>
  3. Abra o .html normalmente (duplo clique) — sem servidor, sem nada.

  Os dados ficam guardados no navegador (localStorage), então
  continuam salvos mesmo depois de fechar e abrir de novo,
  mas só nesse navegador/computador.
*/
(function () {
  const API_BASE_URL = 'http://localhost:5000';
  const LS_PREFIX = 'clarinha_';

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(LS_PREFIX + key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function jsonResponse(body, status) {
    return Promise.resolve(
      new Response(body === undefined ? '' : JSON.stringify(body), {
        status: status || 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
  }

  function errorResponse(status, error) {
    return Promise.resolve(
      new Response(JSON.stringify({ error: error }), {
        status: status,
        headers: { 'Content-Type': 'application/json' }
      })
    );
  }

  function parseBody(options) {
    if (!options || !options.body) return {};
    try {
      const parsed = JSON.parse(options.body);
      return parsed === null ? {} : parsed;
    } catch (e) {
      return {};
    }
  }

  function rawBody(options) {
    if (!options || options.body === undefined) return undefined;
    try {
      return JSON.parse(options.body);
    } catch (e) {
      return undefined;
    }
  }

  async function handleApi(path, options) {
    const method = ((options && options.method) || 'GET').toUpperCase();
    const body = parseBody(options);
    let m;

    // ---- routines ----
    if (path === '/api/routines') {
      if (method === 'GET') return jsonResponse(load('routines', []));
      if (method === 'POST') {
        const list = load('routines', []);
        const item = { id: uid(), name: body.name, exercises: body.exercises || [] };
        list.push(item);
        save('routines', list);
        return jsonResponse(item);
      }
    }
    if ((m = path.match(/^\/api\/routines\/([^/]+)$/))) {
      const id = m[1];
      const list = load('routines', []);
      const idx = list.findIndex((r) => r.id === id);
      if (method === 'PUT') {
        if (idx === -1) return errorResponse(404, 'Rotina não encontrada');
        list[idx] = { ...list[idx], name: body.name, exercises: body.exercises };
        save('routines', list);
        return jsonResponse(list[idx]);
      }
      if (method === 'DELETE') {
        save('routines', list.filter((r) => r.id !== id));
        return jsonResponse({ success: true });
      }
    }

    // ---- history ----
    if (path === '/api/history') {
      if (method === 'GET') return jsonResponse(load('history', []));
      if (method === 'POST') {
        const list = load('history', []);
        const item = { id: uid(), ...body };
        list.push(item);
        save('history', list);
        return jsonResponse(item);
      }
    }
    if ((m = path.match(/^\/api\/history\/([^/]+)$/))) {
      if (method === 'DELETE') {
        save('history', load('history', []).filter((h) => h.id !== m[1]));
        return jsonResponse({ success: true });
      }
    }

    // ---- bodyweight ----
    if (path === '/api/bodyweight') {
      if (method === 'GET') return jsonResponse(load('bodyweight', []));
      if (method === 'POST') {
        const list = load('bodyweight', []);
        const item = { id: uid(), ...body };
        list.push(item);
        save('bodyweight', list);
        return jsonResponse(item);
      }
    }
    if ((m = path.match(/^\/api\/bodyweight\/([^/]+)$/))) {
      if (method === 'DELETE') {
        save('bodyweight', load('bodyweight', []).filter((x) => x.id !== m[1]));
        return jsonResponse({ success: true });
      }
    }

    // ---- measurements ----
    if (path === '/api/measurements') {
      if (method === 'GET') return jsonResponse(load('measurements', []));
      if (method === 'POST') {
        const list = load('measurements', []);
        const item = { id: uid(), ...body };
        list.push(item);
        save('measurements', list);
        return jsonResponse(item);
      }
    }
    if ((m = path.match(/^\/api\/measurements\/([^/]+)$/))) {
      if (method === 'DELETE') {
        save('measurements', load('measurements', []).filter((x) => x.id !== m[1]));
        return jsonResponse({ success: true });
      }
    }

    // ---- exercise photos ----
    if (path === '/api/exercise-photos') {
      if (method === 'GET') return jsonResponse(load('exercisePhotos', {}));
      if (method === 'PUT') {
        const map = load('exercisePhotos', {});
        map[body.name] = body.photo;
        save('exercisePhotos', map);
        return jsonResponse({ success: true });
      }
      if (method === 'DELETE') {
        const map = load('exercisePhotos', {});
        delete map[body.name];
        save('exercisePhotos', map);
        return jsonResponse({ success: true });
      }
    }

    // ---- settings ----
    if (path === '/api/settings') {
      if (method === 'GET') return jsonResponse(load('settings', { weeklyGoal: 4 }));
      if (method === 'PUT') {
        const settings = load('settings', { weeklyGoal: 4 });
        Object.assign(settings, body);
        save('settings', settings);
        return jsonResponse(settings);
      }
    }

    // ---- active workout ----
    if (path === '/api/active') {
      if (method === 'GET') return jsonResponse(load('active', null));
      if (method === 'PUT') {
        const value = rawBody(options);
        save('active', value === undefined ? null : value);
        return jsonResponse({ success: true });
      }
    }

    return errorResponse(404, 'Rota não encontrada: ' + method + ' ' + path);
  }

  const originalFetch = window.fetch.bind(window);

  window.fetch = function (input, options) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf(API_BASE_URL) === 0) {
      return handleApi(url.slice(API_BASE_URL.length), options || {});
    }
    return originalFetch(input, options);
  };
})();
