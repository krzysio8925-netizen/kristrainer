// Firebase web config — the same project as GabiTrainer (public by design; access is guarded by firestore.rules).
export const firebaseConfig = {
  apiKey: 'AIzaSyDZC_XNjIWuKN5ob-1kIsc2txLFTHNfyK4',
  authDomain: 'gabitrainer.firebaseapp.com',
  projectId: 'gabitrainer',
  storageBucket: 'gabitrainer.firebasestorage.app',
  messagingSenderId: '151954042703',
  appId: '1:151954042703:web:4d3d83afb8f31fbbe45f3a',
};

// The only account allowed into the calculator. Must match isKris() in firebase/firestore.rules.
export const OWNER_EMAIL = 'krzysio8925@gmail.com';

// Calculator data lives in its own collection, separate from GabiTrainer clients.
export const ROOT = 'kris_clients';

// Set VITE_USE_EMULATOR=1 to run against the local Firebase emulators instead.
export const useEmulator = import.meta.env.VITE_USE_EMULATOR === '1';
