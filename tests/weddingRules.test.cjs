const { test, before, after, beforeEach } = require('node:test');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, collection, setDoc, updateDoc, getDoc, getDocs, deleteDoc, deleteField, serverTimestamp, onSnapshot, setLogLevel } = require('firebase/firestore');
const { ref, uploadBytes, deleteObject, listAll } = require('firebase/storage');
const A = 'xLUPD71OGYfG4NByDz0buh8ZIsy2';
const B = 'orPQHip5ooOtfSSkyLYhl5hx9Kg1';
const ID = '12345678901234567890';
const PATH = `couples/yushef/weddingTimeline/${ID}`;
setLogLevel('silent'); // Permission-denied writes below are intentional assertions.
let env;
const db = (uid) => uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore();
const data = (uid = A) => ({
  id: ID, title: 'Test moment', subtitle: '', description: '', eventDate: '2026-09-02', plannedDate: null,
  status: 'completed', type: 'rings', createdByUid: uid, createdByName: uid === A ? 'Shosho' : 'Yuyu',
  photos: [], notesByUid: {}, deleting: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
});
const change = (uid, value) => updateDoc(doc(db(uid), PATH), { ...value, updatedAt: serverTimestamp() });
const create = (uid = A) => setDoc(doc(db(uid), PATH), data(uid));
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-yushef',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') }, storage: { rules: fs.readFileSync('storage.rules', 'utf8') }
  });
});
beforeEach(async () => { await env.clearFirestore(); await env.clearStorage(); });
after(async () => { await env?.cleanup(); });

test('both users create, query and edit shared moments; timestamps and identity stay intact', async () => {
  await assertSucceeds(create(A));
  await assertSucceeds(getDocs(collection(db(B), 'couples/yushef/weddingTimeline')));
  await assertSucceeds(change(B, { title: 'A shared edit' }));
  assert.equal((await getDoc(doc(db(A), PATH))).data().title, 'A shared edit');
  await assertFails(change(B, { createdByUid: B, createdByName: 'Yuyu' }));
  await assertFails(change(A, { createdAt: serverTimestamp() }));
  await env.clearFirestore();
  await assertSucceeds(create(B));
});

test('unauthenticated, unrelated UID and wrong couple cannot get/list/write/delete', async () => {
  await create();
  for (const uid of [null, 'uninvited']) {
    await assertFails(getDoc(doc(db(uid), PATH)));
    await assertFails(getDocs(collection(db(uid), 'couples/yushef/weddingTimeline')));
    await assertFails(change(uid, { title: 'Intrusion' }));
    await assertFails(deleteDoc(doc(db(uid), PATH)));
    await assertFails(setDoc(doc(db(uid), `couples/yushef/weddingTimeline/${'x'.repeat(20)}`), { ...data(), id: 'x'.repeat(20) }));
  }
  await assertFails(setDoc(doc(db(A), PATH.replace('yushef', 'other')), data()));
  await assertFails(getDocs(collection(db(A), 'couples/other/weddingTimeline')));
});

test('only the author can write their own note; shared edits preserve both perspectives', async () => {
  await create();
  for (const uid of [A, B]) await assertSucceeds(change(uid, { [`notesByUid.${uid}`]: { text: `Note ${uid}`, updatedAt: serverTimestamp() } }));
  await assertSucceeds(change(B, { subtitle: 'Ours' }));
  for (const [caller, partner] of [[A, B], [B, A]]) {
    await assertFails(change(caller, { [`notesByUid.${partner}`]: { text: 'Forged', updatedAt: serverTimestamp() } }));
    await assertFails(change(caller, { [`notesByUid.${partner}`]: deleteField() }));
    await assertFails(change(caller, { notesByUid: {} }));
  }
  assert.equal(Object.keys((await getDoc(doc(db(A), PATH))).data().notesByUid).length, 2);
  await env.clearFirestore();
  await assertFails(setDoc(doc(db(A), PATH), { ...data(), notesByUid: { [B]: { text: 'Forged', updatedAt: serverTimestamp() } } }));
  await assertSucceeds(setDoc(doc(db(A), PATH), { ...data(), notesByUid: { [A]: { text: 'Mine', updatedAt: serverTimestamp() } } }));
});

test('create and update validation reject invalid schemas, overlong text, foreign photo paths', async () => {
  await assertFails(setDoc(doc(db(A), PATH), { ...data(B) }));
  await assertFails(setDoc(doc(db(A), PATH), { ...data(), extra: 'invalid' }));
  await create();
  for (const invalid of [
    { title: '' }, { title: 'x'.repeat(121) }, { description: 'x'.repeat(10001) }, { title: 42 },
    { title: deleteField() }, { extra: true }, { eventDate: '2026-13-01' }, { eventDate: '2026-02-31' }, { status: 'wrong' }, { type: 'wrong' },
    { notesByUid: { [A]: { text: 'x'.repeat(4001), updatedAt: serverTimestamp() } } },
    { photos: Array(11).fill({}) }, { photos: [{ id: ID, url: 'https://firebasestorage.googleapis.com/v0/b/demo/o/test?alt=media', storagePath: 'couples/other/secret' }] }
  ]) await assertFails(change(A, invalid));
  const photo = { id: ID, url: 'https://firebasestorage.googleapis.com/v0/b/demo/o/test?alt=media', storagePath: `${PATH}/${ID}-test.jpg` };
  await assertSucceeds(change(A, { photos: Array(10).fill(photo) }));
  await assertSucceeds(change(A, { [`notesByUid.${A}`]: { text: 'With ten photos', updatedAt: serverTimestamp() } }));
  await assertSucceeds(change(B, { [`notesByUid.${B}`]: { text: 'Both notes', updatedAt: serverTimestamp() } }));
  await assertSucceeds(change(B, { title: 'Still editable at capacity' }));
  await assertSucceeds(change(A, { deleting: true }));
});

test('real-time listener receives partner edits', async () => {
  await create();
  const received = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { stop(); reject(new Error('Snapshot timed out')); }, 5000);
    const stop = onSnapshot(doc(db(B), PATH), (snapshot) => {
      if (snapshot.data()?.title === 'Live change') { clearTimeout(timeout); stop(); resolve(); }
    }, reject);
  });
  await change(A, { title: 'Live change' });
  await received;
});

test('photo uploads, private reads/listing, immutable objects and retryable cleanup', async () => {
  await create();
  const storage = (uid) => uid ? env.authenticatedContext(uid).storage() : env.unauthenticatedContext().storage();
  const filePath = `${PATH}/${ID}-test.jpg`;
  const bytes = new Uint8Array([1, 2, 3]);
  const upload = (uid, path = filePath, contentType = 'image/jpeg', payload = bytes) => uploadBytes(ref(storage(uid), path), payload, { contentType });
  await assertSucceeds(upload(A));
  await assertSucceeds(listAll(ref(storage(B), PATH)));
  await assertFails(upload(B));
  await assertFails(upload(A, `${PATH}/${ID}-text.txt`, 'text/plain'));
  await assertFails(upload(A, `${PATH}/${ID}-large.jpg`, 'image/jpeg', new Uint8Array(5 * 1024 * 1024 + 1)));
  await assertFails(upload(A, `${PATH}/${ID}-empty.jpg`, 'image/jpeg', new Uint8Array(0)));
  await assertFails(upload(A, filePath.replace('yushef', 'other')));
  await assertFails(upload(A, filePath.replace(ID, 'z'.repeat(20))));
  for (const uid of [null, 'uninvited']) {
    await assertFails(upload(uid, `${PATH}/${ID}-outsider.jpg`));
    await assertFails(listAll(ref(storage(uid), PATH)));
    await assertFails(deleteObject(ref(storage(uid), filePath)));
  }
  await assertFails(deleteDoc(doc(db(B), PATH)));
  await assertSucceeds(change(B, { deleting: true }));
  await assertFails(change(A, { title: 'No edits during cleanup' }));
  await assertFails(change(B, { deleting: false }));
  await assertFails(upload(A, `${PATH}/${ID}-late.jpg`));
  await assertSucceeds(change(A, { deleting: true }));
  await assertSucceeds(deleteObject(ref(storage(B), filePath)));
  await assertSucceeds(deleteDoc(doc(db(A), PATH)));
});
