// src/actions.js
import { store as AppState } from './store.js';
import { db, storage } from './firebaseConfig.js';
import * as UI from './ui.js';
import * as Utils from './utils.js';

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
        const worksRef = collection(db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/items`);
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

        await setDoc(newDocRef, newWork);
        UI.showToast(`"${name}" を登録しました。`);
        
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
        }
        return true;
    }
    try {
        const workRef = doc(db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/items`, workId);
        await updateDoc(workRef, updatedData);
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

        await deleteDoc(doc(db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/items`, workId));
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
        const docRef = doc(collection(db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/tags`));
        await setDoc(docRef, newTag);
        UI.showToast(`タグ「${name}」を作成しました。`);
        return { id: docRef.id, ...newTag };
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
        const batch = writeBatch(db);
        batch.delete(doc(db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/tags`, tagId));
        AppState.works.filter(w => w.tagIds?.includes(tagId)).forEach(work => {
            const newTagIds = work.tagIds.filter(id => id !== tagId);
            batch.update(doc(db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/items`, work.id), { tagIds: newTagIds });
        });
        await batch.commit();
        UI.showToast(`タグ「${tagToDelete.name}」を削除しました。`);
     } catch(error) {
        if (AppState.isDebugMode) console.error("Error deleting tag (Debug):", error);
        else console.error("Error deleting tag.");
        UI.showToast("タグの削除中にエラーが発生しました。", "error");
     }
};