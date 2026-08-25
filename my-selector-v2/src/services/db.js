// src/db.js
import Dexie from 'dexie';
import { collection, getDocs, query, where, Timestamp, doc, getDoc, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
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

// ▼ 修正: syncIdでキャッシュを絞り込めるよう、syncIdをインデックスに追加。
// 以前はローカルキャッシュがsyncIdを区別せず全件返しており、
// 別の同期ID（別アカウント）に切り替えた際に前回のデータがそのまま表示されてしまう原因になっていた。
db.version(2).stores({
    works: 'id, syncId, name, genre, registeredAt, lastSelectedAt, rating',
    tags: 'id, syncId, name',
    syncInfo: 'id'
});

// --- API ---

/**
 * アプリ起動時: IndexedDBから現在のsyncIdに紐づくデータだけを読み込んで即座に返す
 * これにより「ローディング画面」をほぼスキップできます
 */
export const loadLocalData = async () => {
    if (!AppState.syncId) return { works: [], tags: new Map() };

    const works = await db.works.where('syncId').equals(AppState.syncId).toArray();
    const tagsArray = await db.tags.where('syncId').equals(AppState.syncId).toArray();
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
        const tagsData = tagsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), syncId: AppState.syncId }));

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
            return { id: doc.id, ...data, syncId: AppState.syncId };
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
    await db.works.put({ ...work, syncId: AppState.syncId });
};

export const deleteWorkLocal = async (id) => {
    await db.works.delete(id);
};

/**
 * 指定した同期IDのデータ（items・tags・所有者情報）をFirestoreとローカルキャッシュから完全に削除する。
 * 呼び出し前に、対象syncIdの所有者が呼び出し本人であることを確認しておくこと
 * （Firestoreルール側でも所有者以外の削除は拒否される）。
 */
export const deleteSyncIdData = async (syncId) => {
    if (!syncId) return;

    const itemsRef = collection(firestoreDb, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${syncId}/items`);
    const tagsRef = collection(firestoreDb, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${syncId}/tags`);
    const [itemsSnapshot, tagsSnapshot] = await Promise.all([getDocs(itemsRef), getDocs(tagsRef)]);
    const allDocs = [...itemsSnapshot.docs, ...tagsSnapshot.docs];

    // Firestoreのバッチは1回500件までのため、余裕をみて450件ずつに分割
    const CHUNK_SIZE = 450;
    for (let i = 0; i < allDocs.length; i += CHUNK_SIZE) {
        const batch = writeBatch(firestoreDb);
        allDocs.slice(i, i + CHUNK_SIZE).forEach(docSnap => batch.delete(docSnap.ref));
        await batch.commit();
    }

    // items/tagsを全て消してから、所有者情報ドキュメント本体を削除
    const ownerRef = doc(firestoreDb, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${syncId}`);
    await deleteDoc(ownerRef);

    // ローカルキャッシュも削除
    await db.works.where('syncId').equals(syncId).delete();
    await db.tags.where('syncId').equals(syncId).delete();
};

/**
 * バックアップ（works・tags）で、指定した同期IDのデータを完全に置き換える。
 * 大量データでも一度に大きな処理をせず、Firestoreのバッチ上限(500件)を踏まえて
 * 450件ずつ順番に（並列にはしない）書き込むことで、通信・描画の負荷を抑える。
 * onProgress({ phase, current, total }) で進捗をUIに伝えられる。
 */
export const restoreSyncIdData = async (syncId, works, tags, onProgress = () => {}) => {
    if (!syncId) return;
    const CHUNK_SIZE = 450;

    // 1. 既存データを削除
    const itemsRef = collection(firestoreDb, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${syncId}/items`);
    const tagsRef = collection(firestoreDb, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${syncId}/tags`);
    const [itemsSnapshot, tagsSnapshot] = await Promise.all([getDocs(itemsRef), getDocs(tagsRef)]);
    const existingDocs = [...itemsSnapshot.docs, ...tagsSnapshot.docs];

    for (let i = 0; i < existingDocs.length; i += CHUNK_SIZE) {
        onProgress({ phase: 'clearing', current: i, total: existingDocs.length });
        const batch = writeBatch(firestoreDb);
        existingDocs.slice(i, i + CHUNK_SIZE).forEach(docSnap => batch.delete(docSnap.ref));
        await batch.commit();
    }

    // 2. バックアップ内容を書き込み（元のidを維持する）
    const writes = [
        ...works.map(w => { const { id, ...rest } = w; return { ref: doc(itemsRef, id), data: rest }; }),
        ...tags.map(t => { const { id, ...rest } = t; return { ref: doc(tagsRef, id), data: rest }; }),
    ];
    for (let i = 0; i < writes.length; i += CHUNK_SIZE) {
        onProgress({ phase: 'writing', current: i, total: writes.length });
        const batch = writeBatch(firestoreDb);
        writes.slice(i, i + CHUNK_SIZE).forEach(w => batch.set(w.ref, w.data));
        await batch.commit();
    }

    // 3. ローカルキャッシュも置き換え
    onProgress({ phase: 'localCache', current: 0, total: 1 });
    await db.works.where('syncId').equals(syncId).delete();
    await db.tags.where('syncId').equals(syncId).delete();
    await db.works.bulkPut(works.map(w => ({ ...w, syncId })));
    await db.tags.bulkPut(tags.map(t => ({ ...t, syncId })));

    onProgress({ phase: 'done', current: 1, total: 1 });
};