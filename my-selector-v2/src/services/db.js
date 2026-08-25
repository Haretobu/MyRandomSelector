// src/db.js
import Dexie from 'dexie';
import { collection, getDocs, query, where, Timestamp, doc, getDoc, setDoc } from "firebase/firestore";
import { db as firestoreDb } from './firebaseConfig.js'
import { store as AppState } from '../store/store.js';

// データベース定義
export const db = new Dexie('R18RandomSelectorDB');

// スキーマ定義 (検索に使いたいフィールドをインデックスにする)
db.version(1).stores({
    works: 'id, name, genre, registeredAt, lastSelectedAt, rating', 
    tags: 'id, name',
    syncInfo: 'id' // 同期日時などを保存
});

// --- API ---

/**
 * アプリ起動時: IndexedDBからデータを全件読み込んで即座に返す
 * これにより「ローディング画面」をほぼスキップできます
 */
export const loadLocalData = async () => {
    if (!AppState.syncId) return { works: [], tags: new Map() };

    // 現在のSyncIdに紐づくデータだけを取得する設計にするか、
    // あるいはDB自体をSyncIdごとに分けるかですが、
    // ここではシンプルに「全件取得してJS側でフィルタ」か、
    // Dexieのwhere句を使う形にします（今回は全件取得例）
    
    const works = await db.works.toArray();
    const tagsArray = await db.tags.toArray();
    const tags = new Map(tagsArray.map(t => [t.id, t]));

    return { works, tags };
};

/**
 * syncIdの所有者情報を記録する（Firestoreセキュリティルールでの本人確認用）。
 * 未所有のsyncIdであれば自分のuidで新規作成（＝取得）し、
 * 既に所有者が記録済みのsyncIdには何もしない（上書き・乗っ取りはルール側でも禁止する）。
 */
export const claimSyncId = async (syncId, uid) => {
    if (!syncId || !uid) return;
    try {
        const ref = doc(firestoreDb, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${syncId}`);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
            await setDoc(ref, { ownerUid: uid, createdAt: Timestamp.now() });
        }
    } catch (error) {
        console.error('syncIdの所有者情報の記録に失敗しました:', error);
    }
};

/**
 * バックグラウンド同期: Firestoreから最新データを取得してIndexedDBを更新する
 * (onSnapshotの代わり、または併用)
 */
export const syncWithFirestore = async () => {
    if (!AppState.syncId) return;
    
    console.log('🔄 Syncing with Firestore...');
    
    try {
        // 1. Tags Sync
        const tagsRef = collection(firestoreDb, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/tags`);
        const tagsSnapshot = await getDocs(tagsRef);
        const tagsData = tagsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // IndexedDBを一括更新 (putは "あれば更新、なければ作成")
        await db.tags.bulkPut(tagsData);
        
        // 削除されたデータの扱いは難しいですが、簡易的に「全件置き換え」も手です
        // 今回は bulkPut で上書きします

        // 2. Works Sync
        const worksRef = collection(firestoreDb, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/items`);
        const worksSnapshot = await getDocs(worksRef);
        const worksData = worksSnapshot.docs.map(doc => {
            const data = doc.data();
            // TimestampをIndexedDBで扱える形(Date or Number)にする必要があれば変換
            // DexieはDate型をそのまま保存可能ですが、検索用に数値にするのもあり
            return { id: doc.id, ...data };
        });

        await db.works.bulkPut(worksData);
        
        console.log('✅ Sync Complete');
        
        // 最新データを返す
        return { 
            works: worksData, 
            tags: new Map(tagsData.map(t => [t.id, t])) 
        };

    } catch (error) {
        console.error('Sync failed:', error);
        throw error;
    }
};

/**
 * 単一データの保存（Actions.jsから呼ばれる）
 * Firestoreへの保存が成功した後にこれを呼んで、ローカルも更新する
 */
export const saveWorkLocal = async (work) => {
    await db.works.put(work);
};

export const deleteWorkLocal = async (id) => {
    await db.works.delete(id);
};