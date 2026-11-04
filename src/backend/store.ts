import {
  createUserWithEmailAndPassword, onAuthStateChanged, reload, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type User,
} from 'firebase/auth';
import { collection, deleteDoc, doc, getDocs, onSnapshot, setDoc, writeBatch } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import type { Person, PlanVersion } from '../engine/types';
import { OWNER_EMAIL, ROOT } from './config';
import { auth, db } from './firebase';

// ── sesja ──
export function useSession() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [verified, setVerified] = useState(false);
  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setVerified(!!u?.emailVerified); }), []);
  const allowed = !!user && user.email?.toLowerCase() === OWNER_EMAIL.toLowerCase();
  return {
    user, verified, allowed,
    login: (email: string, password: string) => signInWithEmailAndPassword(auth, email.trim(), password),
    signup: async (email: string, password: string) => {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await sendEmailVerification(cred.user);
    },
    resendVerification: () => (auth.currentUser ? sendEmailVerification(auth.currentUser) : Promise.resolve()),
    checkVerified: async () => {
      if (!auth.currentUser) return false;
      await reload(auth.currentUser);
      await auth.currentUser.getIdToken(true);
      setVerified(auth.currentUser.emailVerified);
      return auth.currentUser.emailVerified;
    },
    resetPassword: (email: string) => sendPasswordResetEmail(auth, email.trim()),
    logout: () => signOut(auth),
  };
}
export type Session = ReturnType<typeof useSession>;

export function authError(e: unknown) {
  const code = (e as { code?: string })?.code ?? '';
  if (code.includes('email-already-in-use')) return 'To konto już istnieje. Zaloguj się.';
  if (code.includes('invalid-email')) return 'Ten adres e-mail wygląda na niepoprawny.';
  if (code.includes('weak-password')) return 'Hasło musi mieć co najmniej 6 znaków.';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'Zły e-mail albo hasło.';
  if (code.includes('too-many-requests')) return 'Za dużo prób. Spróbuj za kilka minut.';
  if (code.includes('network')) return 'Brak połączenia z internetem.';
  return 'Coś poszło nie tak. Spróbuj jeszcze raz.';
}

/** Czytelny opis błędu zapisu. */
export function errText(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code.includes('permission-denied')) return 'brak uprawnień – sprawdź reguły bazy w Firebase';
  if (code.includes('unavailable')) return 'brak połączenia z bazą';
  if (code.includes('resource-exhausted')) return 'za dużo zapisów naraz';
  const msg = (e as { message?: unknown })?.message;
  return typeof msg === 'string' && msg ? msg : 'nieznany błąd';
}

// ── dane: kris_clients/{id} i kris_clients/{id}/versions/{vN} ──
export type StoredVersion = PlanVersion & { id: string };

export function listenPersons(onData: (p: Person[]) => void, onError: (e: unknown) => void) {
  return onSnapshot(collection(db, ROOT), snap => onData(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Person, 'id'>) }))), onError);
}
export async function loadVersions(cid: string): Promise<StoredVersion[]> {
  const snap = await getDocs(collection(db, ROOT, cid, 'versions'));
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as PlanVersion) }));
}
export const savePerson = (p: Person) => setDoc(doc(db, ROOT, p.id), { name: p.name, sex: p.sex, createdAt: p.createdAt });
export function saveVersion(cid: string, v: StoredVersion) {
  const { id, ...data } = v;
  return setDoc(doc(db, ROOT, cid, 'versions', id), JSON.parse(JSON.stringify(data)));
}
export async function deletePerson(cid: string, vids: string[]) {
  for (const id of vids) await deleteDoc(doc(db, ROOT, cid, 'versions', id));
  await deleteDoc(doc(db, ROOT, cid));
}

/** Kopia zapasowa: wszystkie osoby z wersjami (format zgodny z eksportem z poprzedniego kalkulatora). */
export type Backup = { schema: 'kris-trainer/backup@1'; clients: (Person & { versions: StoredVersion[] })[] };

export async function exportBackup(): Promise<Backup> {
  const persons = await getDocs(collection(db, ROOT));
  const clients = [];
  for (const d of persons.docs) clients.push({ id: d.id, ...(d.data() as Omit<Person, 'id'>), versions: await loadVersions(d.id) });
  return { schema: 'kris-trainer/backup@1', clients };
}

/** Import kopii: osoby i wersje zapisywane pod tymi samymi id (istniejące są nadpisywane). */
export async function importBackup(b: Backup) {
  if (b?.schema !== 'kris-trainer/backup@1' || !Array.isArray(b.clients)) throw new Error('To nie jest plik kopii kalkulatora Kris Trainer.');
  let n = 0;
  for (const c of b.clients) {
    const batch = writeBatch(db);
    batch.set(doc(db, ROOT, c.id), { name: c.name, sex: c.sex, createdAt: c.createdAt });
    for (const v of c.versions) { const { id, ...data } = v; batch.set(doc(db, ROOT, c.id, 'versions', id), JSON.parse(JSON.stringify(data))); }
    await batch.commit(); n++;
  }
  return n;
}
