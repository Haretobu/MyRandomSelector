// ★ タグ管理・選択モーダル
export const openTagModal = (options) => {
    const App = getApp();
    const { mode = 'manage', currentTagIds = new Set(), workName = '', onConfirm } = options;
    let tempSelectedTagIds = new Set(currentTagIds);
    const titleMap = { manage: 'タグ管理', assign: `「${workName}」のタグを割り当て`, filter: '抽選条件のタグを選択' };
    
    // ▼変更点：検索バーを広くし、絞り込み・並べ替えをアイコン＋ポップアップメニュー化
    const content = `
        <div class="flex flex-col h-[70vh]">
            ${['manage', 'assign'].includes(mode) ? `<div class="flex flex-wrap gap-2 mb-4 p-1 bg-gray-900 rounded-lg"><input type="text" id="newTagName" placeholder="新しいタグ名" class="flex-grow min-w-[150px] bg-gray-700 p-2 rounded-lg"><div class="flex gap-2"><input type="color" id="newTagColor" value="#581c87" class="h-11 w-12 p-1 bg-gray-700 rounded-lg cursor-pointer"><button id="addTagBtn" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold"><i class="fas fa-plus"></i> 追加</button></div></div>` : ''}
            
            <div class="flex items-center gap-2 mb-2 w-full">
                <div class="flex-grow relative min-w-0">
                    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                    <input type="search" id="tagSearchInput" placeholder="タグを検索..." class="w-full bg-gray-700 p-2 pl-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                </div>
                
                ${mode === 'manage' ? `<button id="search-selected-tag-btn" class="shrink-0 w-10 h-10 rounded-lg text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-700" title="選択したタグで検索" disabled><i class="fas fa-search"></i></button>` : ''}
                
                <div class="flex gap-1 shrink-0">
                    ${mode === 'assign' ? `
                    <div class="relative">
                        <button type="button" id="filterTagBtn" class="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center gap-1" title="絞り込み">
                            <span class="text-base leading-none">&#x1F50D;</span>
                            <span class="hidden sm:inline text-sm">絞り込み</span>
                        </button>
                        <div id="filterTagMenu" class="popup-menu hidden absolute right-0 mt-1 w-28 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 py-1">
                            <button type="button" data-filter="all" class="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm text-sky-400 font-bold">すべて</button>
                            <button type="button" data-filter="assigned" class="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm">設定済</button>
                            <button type="button" data-filter="unassigned" class="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm">未設定</button>
                        </div>
                    </div>
                    ` : ''}
                    <div class="relative">
                        <button type="button" id="sortTagBtn" class="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center gap-1" title="並べ替え">
                            <span class="text-base leading-none">&#x2195;</span>
                            <span class="hidden sm:inline text-sm">並べ替え</span>
                        </button>
                        <div id="sortTagMenu" class="popup-menu hidden absolute right-0 mt-1 w-40 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 py-1">
                            <button type="button" data-sort="createdAt_desc" class="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm text-sky-400 font-bold">追加順 (新しい)</button>
                            <button type="button" data-sort="createdAt_asc" class="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm">追加順 (古い)</button>
                            <button type="button" data-sort="name_asc" class="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm">名前順 (昇順)</button>
                            <button type="button" data-sort="useCount_desc" class="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm">頻度順</button>
                        </div>
                    </div>
                </div>
            </div>

            ${!['manage'].includes(mode) ? `<div class="mb-4"><div class="flex justify-between items-center mb-1"><label class="block text-sm text-gray-400">選択中のタグ</label><button type="button" id="reset-selected-tags-btn" class="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700">リセット <i class="fas fa-times ml-1"></i></button></div><div id="tag-selector-preview" class="flex flex-wrap gap-2 p-2 bg-gray-900 rounded-lg min-h-[40px] max-h-24 overflow-y-auto custom-scrollbar"></div></div>` : ''}
            
            <div id="tag-list" class="flex-grow overflow-y-auto pr-2 gap-2 grid grid-cols-1 md:grid-cols-2"></div>
            ${!['manage'].includes(mode) ? `<div class="pt-4 mt-4 border-t border-gray-700 flex justify-end space-x-3"><button id="tag-modal-cancel" class="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg">キャンセル</button><button id="tag-modal-confirm" class="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold">決定</button></div>` : ''}
        </div>`;

    App.openModal(titleMap[mode], content, () => {
        let tagSearchQuery = '', tagFilter = 'all', tagSort = { by: 'createdAt', order: 'desc' };
        const tagListEl = $('#tag-list'), tagPreviewEl = $('#tag-selector-preview');
        let selectedTagForSearch = null;
        const searchSelectedBtn = $('#search-selected-tag-btn');

        const renderTagPreview = () => {
            if(!tagPreviewEl) return;
            const objects = App.getTagObjects(tempSelectedTagIds);
            tagPreviewEl.innerHTML = objects.length > 0 ? objects.map(t => `<span class="px-2 py-1 rounded text-xs" style="background-color:${t.color}; color:${Utils.getContrastColor(t.color)}">${Utils.escapeHTML(t.name)}</span>`).join('') : `<span class="text-xs text-gray-500">タグ未選択</span>`;
        };

        const renderTagList = () => {
            let tagsToRender = [...AppState.tags.values()];
            if(tagSearchQuery) tagsToRender = tagsToRender.filter(t => t.name.toLowerCase().includes(tagSearchQuery.toLowerCase()));
            if(mode === 'assign') {
                if (tagFilter === 'assigned') tagsToRender = tagsToRender.filter(t => tempSelectedTagIds.has(t.id));
                if (tagFilter === 'unassigned') tagsToRender = tagsToRender.filter(t => !tempSelectedTagIds.has(t.id));
            }
            tagsToRender.sort((a, b) => { const o = tagSort.order === 'asc' ? 1 : -1; switch (tagSort.by) { case 'name': return a.name.localeCompare(b.name, 'ja') * o; case 'createdAt': return ((a.createdAt?.toMillis()||0) - (b.createdAt?.toMillis()||0)) * o; case 'useCount': return ((a.useCount||0) - (b.useCount||0)) * o; default: return 0; }});
            tagListEl.innerHTML = tagsToRender.map(t => {
                const isManageMode = mode === 'manage';
                const deleteBtnHtml = (isManageMode || mode === 'assign') ? `<button data-action="delete-tag" data-id="${t.id}" class="ml-auto text-gray-400 hover:text-red-500 px-2 shrink-0" title="タグ削除"><i class="fas fa-trash-alt"></i></button>` : '';
                let selectedClass = '';
                if (isManageMode && selectedTagForSearch === t.name) selectedClass = 'bg-purple-900 ring-2 ring-purple-500';
                else if (!isManageMode && tempSelectedTagIds.has(t.id)) selectedClass = 'bg-purple-900 ring-2 ring-purple-500';
                else selectedClass = 'bg-gray-700';

                return `<div class="tag-item flex items-center p-2 rounded-lg ${isManageMode ? 'hover:bg-gray-600' : 'cursor-pointer hover:bg-gray-600'} ${selectedClass}" data-id="${t.id}" data-name="${Utils.escapeHTML(t.name)}">
                            <div class="w-4 h-4 rounded-full mr-3 shrink-0" style="background-color: ${t.color};"></div>
                            <span class="grow font-semibold truncate">${Utils.escapeHTML(t.name)}</span>
                            ${deleteBtnHtml}
                        </div>`;
            }).join('');
        };

        renderTagList();
        if (tagPreviewEl) renderTagPreview();

        tagListEl.addEventListener('refresh-tags', renderTagList);
        
        // ▼変更点：IME入力バグに対応
        let isComposing = false;
        const searchInputEl = $('#tagSearchInput');
        if (searchInputEl) {
            searchInputEl.addEventListener('compositionstart', () => { isComposing = true; });
            searchInputEl.addEventListener('compositionend', (e) => { 
                isComposing = false; 
                tagSearchQuery = e.target.value; 
                renderTagList(); 
            });
            searchInputEl.addEventListener('input', App.debounce(e => { 
                if (isComposing) return;
                tagSearchQuery = e.target.value; 
                renderTagList(); 
            }, 200));
        }

        // ▼変更点：ポップアップメニューの開閉制御
        const setupMenu = (btnId, menuId) => {
            const btn = $(`#${btnId}`);
            const menu = $(`#${menuId}`);
            if (btn && menu) {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    $$('.popup-menu').forEach(m => { if (m.id !== menuId) m.classList.add('hidden'); });
                    menu.classList.toggle('hidden');
                });
            }
        };
        setupMenu('filterTagBtn', 'filterTagMenu');
        setupMenu('sortTagBtn', 'sortTagMenu');

        // 画面外クリックでメニューを閉じる
        document.addEventListener('click', () => {
            $$('.popup-menu').forEach(m => m.classList.add('hidden'));
        });

        // 絞り込み条件の選択
        $('#filterTagMenu')?.addEventListener('click', e => {
            const btn = e.target.closest('button[data-filter]');
            if (!btn) return;
            tagFilter = btn.dataset.filter;
            $$('#filterTagMenu button').forEach(b => b.classList.remove('text-sky-400', 'font-bold'));
            btn.classList.add('text-sky-400', 'font-bold');
            renderTagList();
            $('#filterTagMenu').classList.add('hidden');
        });

        // 並べ替え条件の選択
        $('#sortTagMenu')?.addEventListener('click', e => {
            const btn = e.target.closest('button[data-sort]');
            if (!btn) return;
            const [by, order] = btn.dataset.sort.split('_');
            tagSort = { by, order };
            $$('#sortTagMenu button').forEach(b => b.classList.remove('text-sky-400', 'font-bold'));
            btn.classList.add('text-sky-400', 'font-bold');
            renderTagList();
            $('#sortTagMenu').classList.add('hidden');
        });

        $('#addTagBtn')?.addEventListener('click', async () => {
            const nameInput = $('#newTagName');
            if (nameInput.value) {
                const newTag = await Actions.addTag(nameInput.value, $('#newTagColor').value);
                if (newTag && mode === 'assign') { tempSelectedTagIds.add(newTag.id); renderTagList(); renderTagPreview(); }
                nameInput.value = '';
            }
        });

        tagListEl.addEventListener('click', e => {
            const tagItem = e.target.closest('.tag-item');
            const deleteBtn = e.target.closest('button[data-action="delete-tag"]');

            if (deleteBtn) { 
                e.stopPropagation(); 
                Actions.deleteTag(deleteBtn.dataset.id); 
                if (mode === 'manage') { selectedTagForSearch = null; if (searchSelectedBtn) searchSelectedBtn.disabled = true; }
                return; 
            }
            
            if (tagItem) {
                e.stopPropagation(); 
                const tagId = tagItem.dataset.id;
                const tagName = tagItem.dataset.name;

                if (mode === 'manage') {
                    if (selectedTagForSearch === tagName) { selectedTagForSearch = null; if (searchSelectedBtn) searchSelectedBtn.disabled = true; } 
                    else { selectedTagForSearch = tagName; if (searchSelectedBtn) searchSelectedBtn.disabled = false; }
                    renderTagList();
                } else {
                    if (tempSelectedTagIds.has(tagId)) tempSelectedTagIds.delete(tagId);
                    else tempSelectedTagIds.add(tagId);
                    renderTagList(); renderTagPreview();
                }
            }
        });

        if (searchSelectedBtn) {
            searchSelectedBtn.addEventListener('click', () => {
                if (selectedTagForSearch) {
                    AppState.ui.searchInput.value = selectedTagForSearch;
                    App.performSearch(selectedTagForSearch);
                    App.closeModal();
                    setTimeout(() => AppState.ui.searchInput.focus(), 300); 
                    UI.showToast(`タグ「${selectedTagForSearch}」で検索しました。`);
                }
            });
        }
        $('#reset-selected-tags-btn')?.addEventListener('click', () => { tempSelectedTagIds.clear(); renderTagPreview(); renderTagList(); });
        $('#tag-modal-confirm')?.addEventListener('click', () => { onConfirm(tempSelectedTagIds); });
        $('#tag-modal-cancel')?.addEventListener('click', () => { onConfirm(null); });
    }, { autoFocus: false });
};


// ★ タグフィルタ選択モーダル (AND/OR/NOT)
// ※こちらも同様にUIを統一させました
export const openTagFilterModal = (options) => {
    const App = getApp();
    const { and = new Set(), or = new Set(), not = new Set(), onConfirm } = options;
    let tempAnd = new Set(and), tempOr = new Set(or), tempNot = new Set(not);

    const content = `
        <div class="flex flex-col h-[70vh]">
            <div class="flex items-center gap-2 mb-2 w-full">
                <div class="flex-grow relative min-w-0">
                    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                    <input type="search" id="tagFilterSearchInput" placeholder="タグを検索..." class="w-full bg-gray-700 p-2 pl-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                </div>
                
                <div class="flex gap-1 shrink-0">
                    <div class="relative">
                        <button type="button" id="sortFilterTagBtn" class="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center gap-1" title="並べ替え">
                            <span class="text-base leading-none">&#x2195;</span>
                            <span class="hidden sm:inline text-sm">並べ替え</span>
                        </button>
                        <div id="sortFilterTagMenu" class="popup-menu hidden absolute right-0 mt-1 w-40 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 py-1">
                            <button type="button" data-sort="createdAt_desc" class="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm text-sky-400 font-bold">追加順 (新しい)</button>
                            <button type="button" data-sort="createdAt_asc" class="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm">追加順 (古い)</button>
                            <button type="button" data-sort="name_asc" class="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm">名前順 (昇順)</button>
                            <button type="button" data-sort="useCount_desc" class="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm">頻度順</button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="flex justify-between items-center mb-4">
                <p class="text-xs text-gray-400">タグをクリックして条件を変更 ( 緑: AND → 青: OR → 赤: NOT → 解除 )</p>
                <button type="button" id="reset-tag-filters-btn" class="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700">リセット</button>
            </div>
            <div id="tag-list" class="flex-grow overflow-y-auto pr-2 space-y-2"></div>
            <div class="pt-4 mt-4 border-t border-gray-700 flex justify-end space-x-3">
                <button id="tag-modal-cancel" class="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg">キャンセル</button>
                <button id="tag-modal-confirm" class="px-6 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg font-semibold">決定</button>
            </div>
        </div>`;

    App.openModal("タグの条件を選択", content, () => {
        let tagSearchQuery = '', tagSort = { by: 'createdAt', order: 'desc' };
        const tagListEl = $('#tag-list');

        const renderTagList = () => {
            let tagsToRender = [...AppState.tags.values()];
            if(tagSearchQuery) {
                const normalizedQuery = App.normalizeString(tagSearchQuery);
                tagsToRender = tagsToRender.filter(t => App.normalizeString(t.name).includes(normalizedQuery));
            }

            tagsToRender.sort((a, b) => { const o = tagSort.order === 'asc' ? 1 : -1; switch (tagSort.by) { case 'name': return a.name.localeCompare(b.name, 'ja') * o; case 'createdAt': return ((a.createdAt?.toMillis()||0) - (b.createdAt?.toMillis()||0)) * o; case 'useCount': return ((a.useCount||0) - (b.useCount||0)) * o; default: return 0; }});

            tagListEl.innerHTML = tagsToRender.map(t => {
                let stateClass = 'bg-gray-700';
                if (tempAnd.has(t.id)) stateClass = 'tag-item-and';
                else if (tempOr.has(t.id)) stateClass = 'tag-item-or';
                else if (tempNot.has(t.id)) stateClass = 'tag-item-not';

                return `<div class="tag-item flex items-center p-2 rounded-lg cursor-pointer hover:bg-gray-600 ${stateClass}" data-id="${t.id}">
                            <div class="w-4 h-4 rounded-full mr-3 shrink-0" style="background-color: ${t.color};"></div>
                            <span class="grow font-semibold truncate">${Utils.escapeHTML(t.name)}</span>
                        </div>`;
            }).join('');
        };

        renderTagList();
        tagListEl.addEventListener('refresh-tags', renderTagList);

        // IME入力バグに対応
        let isComposing = false;
        const searchInputEl = $('#tagFilterSearchInput');
        if (searchInputEl) {
            searchInputEl.addEventListener('compositionstart', () => { isComposing = true; });
            searchInputEl.addEventListener('compositionend', (e) => { 
                isComposing = false; 
                tagSearchQuery = e.target.value; 
                renderTagList(); 
            });
            searchInputEl.addEventListener('input', App.debounce(e => { 
                if (isComposing) return;
                tagSearchQuery = e.target.value; 
                renderTagList(); 
            }, 200));
        }

        // ポップアップメニューの制御
        $('#sortFilterTagBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            $$('.popup-menu').forEach(m => { if (m.id !== 'sortFilterTagMenu') m.classList.add('hidden'); });
            $('#sortFilterTagMenu')?.classList.toggle('hidden');
        });

        $('#sortFilterTagMenu')?.addEventListener('click', e => {
            const btn = e.target.closest('button[data-sort]');
            if (!btn) return;
            const [by, order] = btn.dataset.sort.split('_');
            tagSort = { by, order };
            $$('#sortFilterTagMenu button').forEach(b => b.classList.remove('text-sky-400', 'font-bold'));
            btn.classList.add('text-sky-400', 'font-bold');
            renderTagList();
            $('#sortFilterTagMenu').classList.add('hidden');
        });

        tagListEl.addEventListener('click', e => {
            const tagItem = e.target.closest('.tag-item');
            if (tagItem) {
                const tagId = tagItem.dataset.id;
                if (tempAnd.has(tagId)) { tempAnd.delete(tagId); tempOr.add(tagId); } 
                else if (tempOr.has(tagId)) { tempOr.delete(tagId); tempNot.add(tagId); } 
                else if (tempNot.has(tagId)) { tempNot.delete(tagId); } 
                else { tempAnd.add(tagId); }
                renderTagList();
            }
        });

        $('#reset-tag-filters-btn').addEventListener('click', () => { tempAnd.clear(); tempOr.clear(); tempNot.clear(); renderTagList(); });
        $('#tag-modal-confirm')?.addEventListener('click', () => { onConfirm({and: tempAnd, or: tempOr, not: tempNot}); App.closeModal(); });
        $('#tag-modal-cancel')?.addEventListener('click', () => { onConfirm(null); App.closeModal(); });
    }, { autoFocus: false });
};