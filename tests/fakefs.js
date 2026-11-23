// A stand-in for the Firebase compat SDK, for tests only.
// It implements the part of the compat API that src/data/firestore-store.ts uses (the Store port in
// src/data/store.ts): doc (get, set, update, delete, onSnapshot), collection (orderBy, limit, where '==',
// get, onSnapshot) and FieldValue.increment. Every browser in a test holds a copy of the whole database;
// tests/lib.js relays each write to the other browsers, the way the server would. The same file runs in
// Node in the store contract tests (src/data/store.contract.test.ts), with a plain object as `window`.
(function(){
  let docs = {};
  const listeners = new Set();
  const meta = { fromCache: true, hasPendingWrites: false };       // "from cache" until the first copy arrives
  const clone = o => JSON.parse(JSON.stringify(o));
  const notify = () => setTimeout(() => listeners.forEach(l => l()), 0);
  window.__apply = json => { docs = JSON.parse(json); meta.fromCache = false; notify(); };
  // Field increments travel as the plain marker {__inc: n} (it must survive JSON on its way between phones).
  const isInc = v => v && typeof v === 'object' && typeof v.__inc === 'number';
  const resolve = (cur, d) => { const o = {}; for (const k in d) o[k] = isInc(d[k]) ? (Number(cur && cur[k]) || 0) + d[k].__inc : d[k]; return o; };
  const hasInc = d => !!d && Object.values(d).some(isInc);
  // The write is applied here at once (like Firestore's local cache) and sent to the hub, which applies it to
  // the server copy (increments against the server value) and relays the resulting document to the other phones.
  // The returned promise resolves when the hub has it, like a server acknowledgement.
  const commit = async (path, op, data) => {
    notify();
    if (!window.__push) return;
    const res = await window.__push(JSON.stringify({ path, op, data: data || null }));
    if (res && res.doc && hasInc(data)){ docs[path] = res.doc; notify(); }     // pick up the server's result of an increment
  };
  window.__applyDoc = (path, doc) => { if (doc === null) delete docs[path]; else docs[path] = doc; meta.fromCache = false; notify(); };
  if (window.__pull) window.__pull().then(json => window.__apply(json));
  else meta.fromCache = false;
  const snap = p => ({ id: p.split('/').pop(), exists: p in docs, data: () => docs[p] ? clone(docs[p]) : undefined, metadata: meta });
  function docRef(p){
    return { id: p.split('/').pop(), path: p,
      get: async () => snap(p),
      set: async d => { docs[p] = resolve(null, clone(d)); await commit(p, 'set', clone(d)); },
      // Like Firestore: update replaces each top-level field it names (no deep merge).
      update: async d => { if (!(p in docs)) throw { code: 'not-found' }; Object.assign(docs[p], resolve(docs[p], clone(d))); await commit(p, 'update', clone(d)); },
      delete: async () => { delete docs[p]; await commit(p, 'delete'); },
      onSnapshot(next){ const l = () => next(snap(p)); listeners.add(l); setTimeout(l, 0); return () => listeners.delete(l); } };
  }
  function colRef(p, o = {}){
    const depth = p.split('/').length + 1;
    const run = () => {
      let ds = Object.keys(docs).filter(k => k.startsWith(p + '/') && k.split('/').length === depth).map(snap);
      for (const [f, v] of o.where || []) ds = ds.filter(s => s.data()[f] === v);
      if (o.order){ const [f, dir] = o.order; ds.sort((a, b) => ((a.data()[f] || 0) - (b.data()[f] || 0)) * (dir === 'desc' ? -1 : 1)); }
      if (o.limit) ds = ds.slice(0, o.limit);
      return { docs: ds, size: ds.length, empty: !ds.length, metadata: meta };
    };
    return { path: p, doc: id => docRef(p + '/' + id),
      orderBy: (f, dir) => colRef(p, { ...o, order: [f, dir] }), limit: n => colRef(p, { ...o, limit: n }),
      where: (f, op, v) => colRef(p, { ...o, where: [...(o.where || []), [f, v]] }),
      get: async () => run(),
      onSnapshot(next){ const l = () => next(run()); listeners.add(l); setTimeout(l, 0); return () => listeners.delete(l); } };
  }
  const firestore = () => ({ settings(){}, doc: docRef, collection: colRef });
  firestore.FieldValue = { increment: n => ({ __inc: n }) };
  window.firebase = { initializeApp(){}, firestore };
})();
