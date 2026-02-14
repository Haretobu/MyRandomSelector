/**
 * インポートされたファイル群を解析し、登録用データの配列を生成する裏方モジュール
 */

// 定数（リミッター設定）
const MAX_TOTAL_SIZE_MB = 10;
const MAX_ITEMS_COUNT = 100;
const MAX_TOTAL_SIZE_BYTES = MAX_TOTAL_SIZE_MB * 1024 * 1024;

export const processImportFiles = async (filesArray, App, AppState, defaultRegisteredAt) => {
    if (!filesArray || filesArray.length === 0) {
        throw new Error("ファイルが選択されていません。");
    }

    // 1. 合計容量のチェック
    const totalSize = filesArray.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_TOTAL_SIZE_BYTES) {
        throw new Error(`ファイルサイズの合計が ${MAX_TOTAL_SIZE_MB}MB を超えています。(現在: ${(totalSize / 1024 / 1024).toFixed(2)}MB)`);
    }

    // 2. JSONファイルと画像ファイルに仕分け
    let jsonFile = null;
    const imageFilesMap = new Map(); // ファイル名をキーにして素早く検索できるようにする

    filesArray.forEach(file => {
        if (file.name.toLowerCase().endsWith('.json')) {
            jsonFile = file;
        } else if (file.type.startsWith('image/')) {
            imageFilesMap.set(file.name, file);
        }
    });

    if (!jsonFile) {
        throw new Error("フォルダ内に JSON ファイルが見つかりません。export.json 等を含めてください。");
    }

    // 3. JSONファイルの読み込みと解析
    let jsonData = [];
    try {
        const jsonText = await readFileAsText(jsonFile);
        jsonData = JSON.parse(jsonText);
    } catch (e) {
        throw new Error("JSONファイルの解析に失敗しました。フォーマットが正しいか確認してください。");
    }

    if (!Array.isArray(jsonData)) {
        throw new Error("JSONのデータは配列形式 ([...]) である必要があります。");
    }

    // 4. 件数チェック
    if (jsonData.length > MAX_ITEMS_COUNT) {
        throw new Error(`一度にインポートできるのは ${MAX_ITEMS_COUNT} 件までです。(現在: ${jsonData.length}件)`);
    }
    if (jsonData.length === 0) {
        throw new Error("JSONファイルの中に作品データがありません。");
    }

    // 5. データ結合と重複・類似チェックの実行
    const processedList = [];

    // 非同期処理（画像のBase64化）が含まれるため、Promise.allで並列処理して高速化
    const mapPromises = jsonData.map(async (item) => {
        const name = (item.name || '').trim();
        const url = (item.url || '').trim();
        const genre = (item.genre || '未分類').trim();
        const imageFileName = (item.imageFileName || '').trim();
        
        if (!name) return null; // 名前がないデータはスキップ

        let finalImageData = null;

        // 画像の結合処理
        if (imageFileName && imageFilesMap.has(imageFileName)) {
            const imageFile = imageFilesMap.get(imageFileName);
            try {
                // main.js が持っている画像圧縮・Base64化ユーティリティを借用
                const base64 = await App.processImage(imageFile);
                finalImageData = { 
                    base64: base64, 
                    file: imageFile, 
                    fileName: imageFileName 
                };
            } catch (err) {
                console.warn(`画像 ${imageFileName} の読み込みに失敗しました:`, err);
                // 画像が読み込めなくてもエラーで止めず、画像なしとして続行する
            }
        }

        // 重複・類似チェック処理
        const normalizedLine = App.normalizeString(name);
        let warningStatus = null;
        let warningMessage = null;

        // a. 完全一致チェック (登録済み)
        const isRegistered = AppState.works.some(w => App.normalizeString(w.name) === normalizedLine);
        if (isRegistered) {
            warningStatus = 'duplicate';
            warningMessage = '登録済';
        }

        // b. 類似チェック (登録済み) - 完全一致でない場合のみ
        if (!warningStatus) {
            const isSimilar = AppState.works.some(w => {
                const n = App.normalizeString(w.name);
                return n.includes(normalizedLine) || normalizedLine.includes(n);
            });
            if (isSimilar) {
                warningStatus = 'similar';
                warningMessage = '類似あり';
            }
        }

        // c. リスト内重複チェック (既に一時リストにいるか)
        if (!warningStatus) {
            const isTempDup = AppState.tempWorks.some(w => App.normalizeString(w.name) === normalizedLine);
            if (isTempDup) {
                warningStatus = 'duplicate';
                warningMessage = 'リスト重複';
            }
        }

        // batch.js が扱いやすい綺麗なオブジェクト形式にして返す
        return {
            name: name,
            url: url,
            genre: genre,
            registeredAtStr: defaultRegisteredAt, // Web画面で指定した日付を適用
            imageData: finalImageData,
            site: App.getWorkSite(url),
            warningStatus: warningStatus,
            warningMessage: warningMessage
        };
    });

    // すべての処理が終わるのを待つ
    const results = await Promise.all(mapPromises);
    
    // null (名前が空でスキップされたデータなど) を除外して返す
    return results.filter(item => item !== null);
};

// ヘルパー: Fileオブジェクトをテキストとして読み込むPromiseラップ関数
const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
};