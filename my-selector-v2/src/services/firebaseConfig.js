// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth"; // ★追加: connectAuthEmulator
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore"; // ★追加: connectFirestoreEmulator
import { getStorage, connectStorageEmulator } from "firebase/storage"; // ★追加: connectStorageEmulator
import { getFunctions, connectFunctionsEmulator } from "firebase/functions"; // ★追加: connectFunctionsEmulator
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

// あなたのFirebase設定
const firebaseConfig = {
    apiKey: "AIzaSyAnlTrmb0MW8yznBxpWF6B83R9luFnGVts",
    authDomain: "serecter222.firebaseapp.com",
    projectId: "serecter222",
    storageBucket: "serecter222.firebasestorage.app",
    messagingSenderId: "1019715441654",
    appId: "1:1019715441654:web:6caa7779148cce46c92dd7"
};

// アプリの初期化（1回だけ行われるシングルトン）
const app = initializeApp(firebaseConfig);

// 各サービスの初期化
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app, 'asia-northeast1');

// ▼▼▼ 追加: ローカル環境 (localhost) ならエミュレータに接続する処理 ▼▼▼
// ※「npm run dev」で動かしている時だけ、偽物のデータベース(エミュレータ)に繋がります
if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    console.log("🛠️ Localhost detected! Connecting to Firebase Emulators...");
    
    // Auth
    connectAuthEmulator(auth, "http://localhost:9099");
    
    // Firestore (★ここを 8085 に変更)
    connectFirestoreEmulator(db, 'localhost', 8090);
    
    // Storage
    connectStorageEmulator(storage, 'localhost', 9199);
    
    // Functionsは今回使わないので削除、またはコメントアウト
    // connectFunctionsEmulator(functions, 'localhost', 5001);
}
// ▲▲▲ 追加終了 ▲▲▲

// App Checkの初期化 (ReCaptcha)
/*
if (typeof window !== 'undefined') {
    initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider('6Lem8v8rAAAAAJiur2mblUOHF28x-Vh0zRjg6B6u'),
        isTokenAutoRefreshEnabled: true 
    });
}*/

// 他のファイルで使い回す機能をエクスポート
export { auth, db, storage, functions };
export default app;