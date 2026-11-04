import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

import { firebaseConfig, useEmulator } from './config';

// A named app, so it never clashes with the GabiTrainer panel if both are open in one browser.
const app = initializeApp(useEmulator ? { apiKey: 'demo-key', projectId: 'demo-gabi', authDomain: 'localhost' } : firebaseConfig, 'kris-kalkulator');

export const auth = getAuth(app);
auth.languageCode = 'pl';
export const db = getFirestore(app);

if (useEmulator) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
}
