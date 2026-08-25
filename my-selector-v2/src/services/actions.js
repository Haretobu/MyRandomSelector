// src/actions.js
import { store as AppState } from '../store/store.js';
import { db, storage } from './firebaseConfig.js'; // 同じ階層
import * as UI from '../components/ui.js';
import * as Utils from '../utils/utils.js';

// ★追加: ローカルDBと検索モジュールをインポート
import * as DB from './db.js'; // 同じ階層
import * as Search from '../search.js';
import { logEvent } from './debugLog.js';

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
    // 重複チェック
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

        // 1. Firebaseに保存
        await setDoc(newDocRef, newWork);

        // ★★★ 2. ローカル情報の手動更新 (ここが重要！) ★★★
        const fullWork = { id: newDocRef.id, ...newWork };
        
        // メモリ配列に追加
        AppState.works.push(fullWork);
        
        // ローカルDB (IndexedDB) にも保存
        await DB.saveWorkLocal(fullWork);
        
        // 検索インデックスを更新
        Search.initSearchIndex(AppState.works);
        
        // 画面を再描画 (main.js の renderAll を呼ぶ)
        if (window.App && window.App.renderAll) window.App.renderAll();

        UI.showToast(`"${name}" を登録しました。`);
        
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
    const updatedFields = Object.keys(updatedData || {});
    const startedAt = Date.now();
    logEvent('updateWork', 'start', { workId, fields: updatedFields, debugMode: !!AppState.isDebugMode });

    if (AppState.isDebugMode) {
        // デバッグモード用簡易更新
        const workIndex = AppState.works.findIndex(w => w.id === workId);
        if (workIndex !== -1) {
            AppState.works[workIndex] = { ...AppState.works[workIndex], ...updatedData };
            if (window.App && window.App.renderAll) window.App.renderAll();
        }
        logEvent('updateWork', 'successDebugMode', { workId, ms: Date.now() - startedAt });
        return true;
    }
    try {
        const workRef = doc(db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/items`, workId);

        // 1. Firebase更新
        await updateDoc(workRef, updatedData);

        // ★★★ 2. ローカル手動更新 ★★★
        const index = AppState.works.findIndex(w => w.id === workId);
        if (index !== -1) {

            // FieldValueによるクラッシュを防ぐため、ローカル用の更新データを生成
            const localUpdatedData = { ...updatedData };
            
            const delToken = deleteField();
            for (const key of Object.keys(localUpdatedData)) {
                if (localUpdatedData[key] && typeof localUpdatedData[key].isEqual === 'function' && localUpdatedData[key].isEqual(delToken)) {
                    delete localUpdatedData[key];
                    delete AppState.works[index][key];
                }
            }

            // selectionHistoryに特殊なオブジェクト(arrayUnion)が含まれている場合、ローカル配列に変換
            if (localUpdatedData.selectionHistory && typeof localUpdatedData.selectionHistory === 'object' && localUpdatedData.selectionHistory.constructor.name !== 'Array') {
                const currentHistory = Array.isArray(AppState.works[index].selectionHistory) 
                    ? [...AppState.works[index].selectionHistory] 
                    : [];
                if (localUpdatedData.lastSelectedAt) {
                    currentHistory.push(localUpdatedData.lastSelectedAt);
                }
                localUpdatedData.selectionHistory = currentHistory;
            }

            // メモリ上のデータを更新
            const mergedWork = { ...AppState.works[index], ...localUpdatedData };
            AppState.works[index] = mergedWork;
            
            // ローカルDB更新
            await DB.saveWorkLocal(mergedWork);

            // 画面更新
            Search.initSearchIndex(AppState.works);
            if (window.App && window.App.renderAll) window.App.renderAll();
        } else {
            logEvent('updateWork', 'workNotFoundInLocalState', { workId });
        }

        logEvent('updateWork', 'success', { workId, fields: updatedFields, ms: Date.now() - startedAt });
        return true;
    } catch (error) {
        if (AppState.isDebugMode) console.error("Error updating work (Debug):", error);
        else console.error("Error updating work.");
        logEvent('updateWork', 'error', {
            workId,
            fields: updatedFields,
            ms: Date.now() - startedAt,
            code: error?.code || null,
            name: error?.name || null,
            message: (error?.message || '').slice(0, 200),
        });
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

        // 1. Firebase削除
        await deleteDoc(doc(db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/items`, workId));

        // ★★★ 2. ローカル手動更新 ★★★
        // メモリから削除
        AppState.works = AppState.works.filter(w => w.id !== workId);
        
        // ローカルDBから削除
        await DB.deleteWorkLocal(workId);
        
        // 画面更新
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
        const docRef = doc(collection(db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/tags`));
        
        // 1. Firebase保存
        await setDoc(docRef, newTag);
        
        // ★★★ 2. ローカル手動更新 ★★★
        const fullTag = { id: docRef.id, ...newTag };
        AppState.tags.set(docRef.id, fullTag);
        await DB.db.tags.put({ ...fullTag, syncId: AppState.syncId }); // db.jsのインスタンスへアクセス
        
        if (window.App && window.App.renderAll) window.App.renderAll();

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
        
        const worksToUpdate = AppState.works.filter(w => w.tagIds?.includes(tagId));
        worksToUpdate.forEach(work => {
            const newTagIds = work.tagIds.filter(id => id !== tagId);
            batch.update(doc(db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/items`, work.id), { tagIds: newTagIds });
        });
        
        // 1. Firebase削除
        await batch.commit();

        // ★★★ 2. ローカル手動更新 ★★★
        AppState.tags.delete(tagId);
        await DB.db.tags.delete(tagId);
        
        // 影響を受けた作品のタグIDリストも更新
        for (const work of worksToUpdate) {
            work.tagIds = work.tagIds.filter(id => id !== tagId);
            await DB.saveWorkLocal(work);
        }

        if (window.App && window.App.renderAll) window.App.renderAll();

        UI.showToast(`タグ「${tagToDelete.name}」を削除しました。`);
     } catch(error) {
        if (AppState.isDebugMode) console.error("Error deleting tag (Debug):", error);
        else console.error("Error deleting tag.");
        UI.showToast("タグの削除中にエラーが発生しました。", "error");
     }
};

// ★ グループ追加ロジック
export const addGroup = async (name, color) => {
     if (AppState.isDebugMode) { return UI.showToast("デバッグモード中はグループを作成できません。"); }
     const trimmedName = name.trim();
     const normalizedName = trimmedName.toLowerCase();
     if (!trimmedName) return null;
     if ([...AppState.groups.values()].some(g => g.name.toLowerCase() === normalizedName)) {
        UI.showToast("同じ名前のグループが既に存在します。", "error"); return null;
     }
     const newGroup = { name: trimmedName, color: color || '#6366f1', createdAt: Timestamp.now() };
     try {
        const docRef = doc(collection(db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/groups`));
        await setDoc(docRef, newGroup);

        const fullGroup = { id: docRef.id, ...newGroup };
        AppState.groups.set(docRef.id, fullGroup);
        await DB.db.groups.put({ ...fullGroup, syncId: AppState.syncId });

        if (window.App && window.App.renderAll) window.App.renderAll();
        UI.showToast(`グループ「${trimmedName}」を作成しました。`);
        return fullGroup;
     } catch (error) {
        if (AppState.isDebugMode) console.error("Error adding group (Debug):", error);
        else console.error("Error adding group.");
        UI.showToast("グループの作成に失敗しました。", "error"); return null;
     }
};

// ★ グループ削除ロジック（所属していたタグは「未分類」に戻す）
export const deleteGroup = async (groupId) => {
     if (AppState.isDebugMode) { return UI.showToast("デバッグモード中はグループを削除できません。"); }
     const groupToDelete = AppState.groups.get(groupId);
     if (!groupToDelete || !await UI.showConfirm("グループの削除", `グループ「${Utils.escapeHTML(groupToDelete.name)}」を削除しますか？<br>このグループに属するタグは「未分類」に戻ります。`)) return;
     try {
        const batch = writeBatch(db);
        batch.delete(doc(db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/groups`, groupId));

        const tagsToUpdate = [...AppState.tags.values()].filter(t => t.groupId === groupId);
        tagsToUpdate.forEach(tag => {
            batch.update(doc(db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/tags`, tag.id), { groupId: null });
        });

        await batch.commit();

        AppState.groups.delete(groupId);
        await DB.db.groups.delete(groupId);

        for (const tag of tagsToUpdate) {
            tag.groupId = null;
            await DB.db.tags.put({ ...tag, syncId: AppState.syncId });
        }

        if (window.App && window.App.renderAll) window.App.renderAll();
        UI.showToast(`グループ「${groupToDelete.name}」を削除しました。`);
     } catch (error) {
        if (AppState.isDebugMode) console.error("Error deleting group (Debug):", error);
        else console.error("Error deleting group.");
        UI.showToast("グループの削除中にエラーが発生しました。", "error");
     }
};

// ★ タグの所属グループを変更（groupIdにnullを渡すと「未分類」に戻す）
export const setTagGroup = async (tagId, groupId) => {
     if (AppState.isDebugMode) { return UI.showToast("デバッグモード中はグループを変更できません。"); }
     const tag = AppState.tags.get(tagId);
     if (!tag) return;
     try {
        await updateDoc(doc(db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/tags`, tagId), { groupId: groupId || null });

        tag.groupId = groupId || null;
        await DB.db.tags.put({ ...tag, syncId: AppState.syncId });

        if (window.App && window.App.renderAll) window.App.renderAll();
     } catch (error) {
        if (AppState.isDebugMode) console.error("Error setting tag group (Debug):", error);
        else console.error("Error setting tag group.");
        UI.showToast("グループの割り当てに失敗しました。", "error");
     }
};

// ★ グループ定義＋タグ→グループ対応表のJSONを一括反映する
// data: { groups: [{ name, color? }], assignments: { [タグ名]: グループ名 } }
// 戻り値: { createdGroups, assignedTags, unmatchedTags: string[], unmatchedGroups: string[] }
export const bulkImportGroups = async (data) => {
     if (AppState.isDebugMode) { UI.showToast("デバッグモード中は一括インポートできません。"); return null; }
     if (!data || typeof data !== 'object') { UI.showToast("インポートするデータの形式が正しくありません。", "error"); return null; }

     const inputGroups = Array.isArray(data.groups) ? data.groups : [];
     const assignments = (data.assignments && typeof data.assignments === 'object' && !Array.isArray(data.assignments)) ? data.assignments : {};

     try {
        const groupsRef = collection(db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/groups`);
        const tagsRef = collection(db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/tags`);

        // 1. 既存グループ名 -> グループ を引けるようにしておく
        const groupByName = new Map([...AppState.groups.values()].map(g => [g.name.trim().toLowerCase(), g]));
        const newGroupDocs = []; // {ref, data, fullGroup}

        for (const g of inputGroups) {
            const gName = (g && typeof g.name === 'string') ? g.name.trim() : '';
            if (!gName) continue;
            const key = gName.toLowerCase();
            if (groupByName.has(key)) continue; // 既存グループは作り直さない
            const docRef = doc(groupsRef);
            const groupData = { name: gName, color: (g && g.color) || '#6366f1', createdAt: Timestamp.now() };
            newGroupDocs.push({ ref: docRef, data: groupData, fullGroup: { id: docRef.id, ...groupData } });
            groupByName.set(key, { id: docRef.id, ...groupData });
        }

        // 2. タグ名 -> タグ を引けるようにしておく（既存のタグ名重複チェックと同じ正規化）
        const tagByName = new Map([...AppState.tags.values()].map(t => [t.name.trim().toLowerCase(), t]));
        const tagUpdates = []; // {tagId, groupId}
        const unmatchedTags = [];
        const unmatchedGroups = [];

        for (const [tagName, groupName] of Object.entries(assignments)) {
            const tag = tagByName.get(String(tagName).trim().toLowerCase());
            if (!tag) { unmatchedTags.push(tagName); continue; }
            const group = groupByName.get(String(groupName).trim().toLowerCase());
            if (!group) { unmatchedGroups.push(groupName); continue; }
            tagUpdates.push({ tagId: tag.id, groupId: group.id });
        }

        // 3. Firestoreへ書き込み（500件上限を考慮して分割）
        const writes = [
            ...newGroupDocs.map(g => ({ ref: g.ref, type: 'set', data: g.data })),
            ...tagUpdates.map(u => ({ ref: doc(tagsRef, u.tagId), type: 'update', data: { groupId: u.groupId } })),
        ];
        const CHUNK_SIZE = 450;
        for (let i = 0; i < writes.length; i += CHUNK_SIZE) {
            const batch = writeBatch(db);
            writes.slice(i, i + CHUNK_SIZE).forEach(w => {
                if (w.type === 'set') batch.set(w.ref, w.data);
                else batch.update(w.ref, w.data);
            });
            await batch.commit();
        }

        // 4. ローカル状態も更新
        for (const g of newGroupDocs) {
            AppState.groups.set(g.fullGroup.id, g.fullGroup);
            await DB.db.groups.put({ ...g.fullGroup, syncId: AppState.syncId });
        }
        for (const u of tagUpdates) {
            const tag = AppState.tags.get(u.tagId);
            if (tag) {
                tag.groupId = u.groupId;
                await DB.db.tags.put({ ...tag, syncId: AppState.syncId });
            }
        }

        if (window.App && window.App.renderAll) window.App.renderAll();

        return {
            createdGroups: newGroupDocs.length,
            assignedTags: tagUpdates.length,
            unmatchedTags,
            unmatchedGroups,
        };
     } catch (error) {
        if (AppState.isDebugMode) console.error("Error importing groups (Debug):", error);
        else console.error("Error importing groups.");
        UI.showToast("グループの一括インポートに失敗しました。", "error");
        return null;
     }
};