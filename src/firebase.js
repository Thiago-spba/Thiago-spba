import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

const firebaseConfig = {
  "apiKey": "AIzaSyBg2AEb82yO5Sk2TPuITfdPRscoDr-P2P8",
  "authDomain": "controle-de-aulas-c2973.firebaseapp.com",
  "projectId": "controle-de-aulas-c2973",
  "storageBucket": "controle-de-aulas-c2973.firebasestorage.app",
  "messagingSenderId": "662572820697",
  "appId": "1:662572820697:web:0d15bd23d25786a6cb76c8"
};

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
export { signInWithPopup, signOut };
