// src/actions.js
import { store as AppState } from './store.js';
import { db as firestoreDb, storage } from './firebaseConfig.js'; // 名前衝突回避のため firestoreDb にエイリアス
import * as UI from './ui.js';
import * as Utils from './utils.js';

// ★追加: ローカルDBと検索モジュール
import * as DB from './db.js';
import * as Search from './search.js';

import { 
    collection, doc, setDoc, updateDoc, deleteDoc, writeBatch, 
    Timestamp, arrayUnion, deleteField 
} from "firebase/firestore";
import { ref, uploadString, getDownloadURL, deleteObject } from "firebase/storage";

// ★ Storageへのアップロード処理
export const uploadImageToStorage = async (dataUrl, workId) => {
    if (!dataUrl || !dataUrl.startsWith('data:image')) return null;
    const timestamp = Date.now();
    const path = `works/${AppState.syncId}/${workId}_${timestamp}.jpg`;
    const storageRef = ref(storage, path);
    
    await uploadString(storageRef, dataUrl, 'data_url');
    return await getDownloadURL(storageRef);
};

// ★ 作品追加ロジック
export const handleAddWork = async (e) => {
    e.preventDefault();
    if (AppState.isDebugMode) { return UI.showToast("デバッグモード中は作品を登録できません。"); }
    
    const form = e.target;
    const name = form.elements.workName.value.trim();
    // DOM要素を直接取得
    const registeredAtInput = document.getElementById('workRegisteredAt');
    const registeredAtStr = registeredAtInput ? registeredAtInput.value : '';
    
    if (!name || !registeredAtStr) return UI.showToast("作品名と登録日は必須です。");
    if (!Utils.isValidDate(registeredAtStr)) return UI.showToast("登録日の形式が正しくありません (YYYY/MM/DD)。");
    
    const errorEl = document.getElementById('addWorkError');
    if (AppState.works.some(w => w.name.toLowerCase() === name.toLowerCase())) {
        if(errorEl) {
            errorEl.textContent = `「${name}」は既に登録されています。`;
            errorEl.classList.remove('hidden');
            setTimeout(() => { errorEl.classList.add('hidden'); errorEl.textContent = ''; }, 4000);
        }
        return;
    }

    try {
        const worksRef = collection(firestoreDb, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/items`);
        const newDocRef = doc(worksRef); 
        
        let imageUrl = null;
        let imageFileName = null;

        if (form.elements.workImage.files[0]) {
            try {
                const file = form.elements.workImage.files[0];
                imageFileName = file.name;
                // Utils.processImage を使用
                const tempBase64 = await Utils.processImage(file); 
                imageUrl = await uploadImageToStorage(tempBase64, newDocRef.id);
            } catch (error) { return UI.showToast(error.message); }
        }

        const url = form.elements.workUrl.value.trim();
        const newWork = {
            name,
            genre: form.elements.workGenre.value,
            sourceUrl: url,
            registeredAt: Timestamp.fromDate(new Date(registeredAtStr.replace(/\//g, '-'))),
            imageUrl, 
            imageFileName,
            selectionCount: 0, rating: 0, tagIds: [], lastSelectedAt: null,
            selectionHistory: []
        };

        // 1. Firestoreに保存
        await setDoc(newDocRef, newWork);
        UI.showToast(`"${name}" を登録しました。`);

        // ★★★ 2. ローカル状態とDBを同期 (onSnapshotの代わり) ★★★
        const fullWork = { id: newDocRef.id, ...newWork };
        
        // メモリに追加
        AppState.works.push(fullWork); // 先頭に追加したい場合は unshift
        
        // IndexedDBに追加
        await DB.saveWorkLocal(fullWork);
        
        // 検索インデックス更新
        Search.initSearchIndex(AppState.works);
        
        // 画面再描画
        if (window.App && window.App.renderAll) window.App.renderAll();
        
        // フォームクリア
        form.elements.workName.value = '';
        form.elements.workUrl.value = '';
        form.elements.workImage.value = '';
        const preview = document.getElementById('imagePreview');
        if(preview) {
             preview.classList.add('hidden');
             preview.src = '';
        }

    } catch (error) {
        if (AppState.isDebugMode) console.error("Error adding work:", error);
        UI.showToast("作品の登録に失敗しました。", "error");
    }
};

// ★ 作品更新ロジック
export const updateWork = async (workId, updatedData) => {
    if (AppState.isDebugMode) {
        const workIndex = AppState.works.findIndex(w => w.id === workId);
        if (workIndex !== -1) {
            AppState.works[workIndex] = { ...AppState.works[workIndex], ...updatedData };
            // デバッグモードでは簡易的に成功を返す
            if (window.App && window.App.renderAll) window.App.renderAll();
        }
        return true;
    }
    try {
        const workRef = doc(firestoreDb, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/items`, workId);
        
        // 1. Firestore更新
        await updateDoc(workRef, updatedData);

        // ★★★ 2. ローカル状態とDBを同期 ★★★
        const index = AppState.works.findIndex(w => w.id === workId);
        if (index !== -1) {
            // メモリ上のデータをマージ
            const mergedWork = { ...AppState.works[index], ...updatedData };
            AppState.works[index] = mergedWork;
            
            // IndexedDB更新
            await DB.saveWorkLocal(mergedWork);
            
            // 検索インデックス更新 & 再描画
            Search.initSearchIndex(AppState.works);
            if (window.App && window.App.renderAll) window.App.renderAll();
        }

        return true;
    } catch (error) {
        if (AppState.isDebugMode) console.error("Error updating work (Debug):", error);
        else console.error("Error updating work.");
        UI.showToast("作品の更新に失敗しました。", "error");
        return false;
    }
};

// ★ 作品削除ロジック
export const deleteWork = async (workId, workName) => {
    if (!await UI.showConfirm("作品の削除", `「${Utils.escapeHTML(workName)}」を本当に削除しますか？<br>この操作は取り消せません。`)) return;
    
    try {
        const work = AppState.works.find(w => w.id === workId);
        if (work && work.imageUrl && work.imageUrl.includes('firebasestorage')) {
            try {
                const imageRef = ref(storage, work.imageUrl);
                await deleteObject(imageRef);
            } catch (e) {
                console.log("画像削除スキップ:", e);
            }
        }

        // 1. Firestore削除
        await deleteDoc(doc(firestoreDb, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/items`, workId));
        
        // ★★★ 2. ローカル同期 ★★★
        // メモリから削除
        AppState.works = AppState.works.filter(w => w.id !== workId);
        
        // IndexedDBから削除
        await DB.deleteWorkLocal(workId);
        
        // 検索インデックス更新 & 再描画
        Search.initSearchIndex(AppState.works);
        if (window.App && window.App.renderAll) window.App.renderAll();

        UI.showToast(`「${workName}」を削除しました。`);
    } catch (error) {
        if (AppState.isDebugMode) console.error("Error deleting work:", error);
        UI.showToast("作品の削除に失敗しました。", "error");
    }
};

// ★ タグ追加ロジック
export const addTag = async (name, color) => {
     if (AppState.isDebugMode) { return UI.showToast("デバッグモード中はタグを作成できません。"); }
     const normalizedName = name.trim().toLowerCase();
     if ([...AppState.tags.values()].some(t => t.name.toLowerCase() === normalizedName)) {
        UI.showToast("同じ名前のタグが既に存在します。", "error"); return null;
     }
     const newTag = {
        name: name.trim(), color, useCount: 0,
        createdAt: Timestamp.now(), lastSelectedAt: null
     };
     try {
        const docRef = doc(collection(firestoreDb, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/tags`));
        
        // 1. Firestore追加
        await setDoc(docRef, newTag);
        
        // ★★★ 2. ローカル同期 ★★★
        const fullTag = { id: docRef.id, ...newTag };
        
        // メモリ追加
        AppState.tags.set(docRef.id, fullTag);
        
        // DB追加 (DB.db.tags にアクセス)
        await DB.db.tags.put(fullTag);
        
        // リスト更新が必要かもしれないので再描画
        if (window.App && window.App.renderAll) window.App.renderAll();

        UI.showToast(`タグ「${name}」を作成しました。`);
        return fullTag;
     } catch (error) {
        if (AppState.isDebugMode) console.error("Error adding tag (Debug):", error);
        else console.error("Error adding tag.");
        UI.showToast("タグの作成に失敗しました。", "error"); return null;
     }
};

// ★ タグ削除ロジック
export const deleteTag = async (tagId) => {
     if (AppState.isDebugMode) { return UI.showToast("デバッグモード中はタグを削除できません。"); }
     const tagToDelete = AppState.tags.get(tagId);
     if (!tagToDelete || !await UI.showConfirm("タグの削除", `タグ「${Utils.escapeHTML(tagToDelete.name)}」を削除しますか？<br>全ての作品からこのタグが解除されます。`)) return;
     try {
        const batch = writeBatch(firestoreDb);
        batch.delete(doc(firestoreDb, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/tags`, tagId));
        
        // 対象の作品を特定しておく
        const worksToUpdate = AppState.works.filter(w => w.tagIds?.includes(tagId));
        
        worksToUpdate.forEach(work => {
            const newTagIds = work.tagIds.filter(id => id !== tagId);
            batch.update(doc(firestoreDb, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/items`, work.id), { tagIds: newTagIds });
        });
        
        // 1. Firestoreコミット
        await batch.commit();

        // ★★★ 2. ローカル同期 ★★★
        // タグ削除
        AppState.tags.delete(tagId);
        await DB.db.tags.delete(tagId);

        // 作品内のタグID削除
        for (const work of worksToUpdate) {
            work.tagIds = work.tagIds.filter(id => id !== tagId);
            await DB.saveWorkLocal(work); // DB上の作品データも更新
        }
        
        // 再描画
        if (window.App && window.App.renderAll) window.App.renderAll();

        UI.showToast(`タグ「${tagToDelete.name}」を削除しました。`);
     } catch(error) {
        if (AppState.isDebugMode) console.error("Error deleting tag (Debug):", error);
        else console.error("Error deleting tag.");
        UI.showToast("タグの削除中にエラーが発生しました。", "error");
     }
};