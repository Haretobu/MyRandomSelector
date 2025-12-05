// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
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

// App Checkの初期化 (ReCaptcha)
/*
if (typeof window !== 'undefined') {
    // ローカル開発環境(localhost)ではデバッグトークンが必要になる場合がありますが、
    // いったん本番と同じ設定で進めます。
    initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider('6Lem8v8rAAAAAJiur2mblUOHF28x-Vh0zRjg6B6u'),
        isTokenAutoRefreshEnabled: true 
    });
}*/

// 他のファイルで使い回す機能をエクスポート
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'asia-northeast1');

export default app;