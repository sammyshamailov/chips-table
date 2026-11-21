// A stand-in for the Firebase compat SDK, for tests only.
// It implements the small part of the Firestore API that index.html uses (doc, collection,
// orderBy, limit, get, set, update, delete, onSnapshot). Every browser in a test holds a copy of
// the whole database; tests/lib.js relays each write to the other browsers, the way the server would.
(function(){
  let docs = {};
  const listeners = new Set();
  const meta = { fromCache: true, hasPendingWrites: false };       // "from cache" until the first copy arrives
  const clone = o => JSON.parse(JSON.stringify(o));
  const notify = () => setTimeout(() => listeners.forEach(l => l()), 0);
  window.__apply = json => { docs = JSON.parse(json); meta.fromCache = false; notify(); };
  const commit = () => { notify(); if (window.__push) window.__push(JSON.stringify(docs)); };
  if (window.__pull) window.__pull().then(json => window.__apply(json));
  else meta.fromCache = false;
  const snap = p => ({ id: p.split('/').pop(), exists: p in docs, data: () => docs[p] ? clone(docs[p]) : undefined, metadata: meta });
  function docRef(p){
    return { id: p.split('/').pop(), path: p,
      get: async () => snap(p),
      set: async d => { docs[p] = clone(d); commit(); },
      // Like Firestore: update replaces each top-level field it names (no deep merge).
      update: async d => { if (!(p in docs)) throw { code: 'not-found' }; Object.assign(docs[p], clone(d)); commit(); },
      delete: async () => { delete docs[p]; commit(); },
      onSnapshot(next){ const l = () => next(snap(p)); listeners.add(l); setTimeout(l, 0); return () => listeners.delete(l); } };
  }
  function colRef(p, o = {}){
    const depth = p.split('/').length + 1;
    const run = () => {
      let ds = Object.keys(docs).filter(k => k.startsWith(p + '/') && k.split('/').length === depth).map(snap);
      if (o.order){ const [f, dir] = o.order; ds.sort((a, b) => ((a.data()[f] || 0) - (b.data()[f] || 0)) * (dir === 'desc' ? -1 : 1)); }
      if (o.limit) ds = ds.slice(0, o.limit);
      return { docs: ds, size: ds.length, empty: !ds.length, metadata: meta };
    };
    return { path: p, doc: id => docRef(p + '/' + id),
      orderBy: (f, dir) => colRef(p, { ...o, order: [f, dir] }), limit: n => colRef(p, { ...o, limit: n }),
      get: async () => run(),
      onSnapshot(next){ const l = () => next(run()); listeners.add(l); setTimeout(l, 0); return () => listeners.delete(l); } };
  }
  window.firebase = { initializeApp(){}, firestore(){ return { settings(){}, doc: docRef, collection: colRef }; } };
})();
