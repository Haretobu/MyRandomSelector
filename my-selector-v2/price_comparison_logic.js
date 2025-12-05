// ↓ 新しい設定ファイルを読み込む（これだけでFirebase接続完了！）
import { auth, db } from './src/firebaseConfig';
import { signInWithEmailAndPassword, onIdTokenChanged } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";

// CDN版のimportは削除しました。
// firebaseConfigの設定も src/firebaseConfig.js に任せるので削除しました。

// --- 変数定義 ---
const appId = 'r18-random-selector'; // 以前のコードに合わせて定数化
// const firebaseConfigStr = ... (不要なので削除またはコメントアウトのままでOK)

let selectorWorks = [];
let unsubscribeSelectorWorks = () => {};
let syncId = '';
let currentUser = null;
let ownedItems = new Set();
let uniqueId = 0;
let bookmarkletCode = '';

// ... (以下、checkUrlParams 関数などはそのまま) ...
// ブックマークレットから渡されたパラメータをフォームに自動入力
function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const data = {
        title: params.get('title'),
        price: params.get('price'),
        discount: params.get('discount'),
        site: params.get('site')
    };

    // Clear the URL params if any exist
    if (data.title || data.price || data.discount || data.site) {
        history.replaceState(null, '', window.location.pathname);
    }

    return data;
}

const initializeFirebase = () => {
    // 新しい環境では src/firebaseConfig.js で初期化済みなので
    // ここでは認証監視をスタートさせるだけでOKです
    setupAuthObserver();
};

const setupAuthObserver = () => {
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    const loginOverlay = document.getElementById('login-overlay');
    const appContainer = document.getElementById('app-container');

    onIdTokenChanged(auth, user => {
        if (user) {
            // --- ログイン済み ---
            loginOverlay.classList.add('hidden');
            loadingOverlay.classList.remove('hidden');
            if(loadingText) loadingText.textContent = '認証情報を確認中...';

            if (!currentUser) {
                currentUser = user;
                setupSyncIdAndSubscribe();
            }
        } else {
            // --- 未ログイン ---
            loadingOverlay.classList.add('hidden');
            appContainer.classList.add('opacity-0');
            loginOverlay.classList.remove('hidden');
        }
    });
};

const setupSyncIdAndSubscribe = () => {
    syncId = localStorage.getItem('r18_sync_id');
    if (!syncId) {
        console.warn("Sync ID not found. Cannot check for duplicates.");
        return;
    }
    subscribeToSelectorWorks();
};

const subscribeToSelectorWorks = () => {
    unsubscribeSelectorWorks();
    const worksRef = collection(db, `/artifacts/${appId}/public/data/r18_works_sync/${syncId}/items`);
    unsubscribeSelectorWorks = onSnapshot(worksRef, (snapshot) => {
        selectorWorks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const loadingOverlay = document.getElementById('loading-overlay');
        if (!loadingOverlay.classList.contains('hidden')) {
            const appContainer = document.getElementById('app-container');

            loadingOverlay.classList.add('opacity-0');
            appContainer.classList.remove('opacity-0');
            setTimeout(() => loadingOverlay.classList.add('hidden'), 500);

            const urlData = checkUrlParams(); 
            if (urlData.title || urlData.price || urlData.discount || urlData.site) {
                document.dispatchEvent(new CustomEvent('applyBookmarkletData', { detail: urlData }));
            }
        }

    }, error => {
        console.error("Error fetching selector works:", error);
    });
};

const normalizeName = (str) => {
    if (!str) return '';
    return str
        .toLowerCase()
        .replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
        .replace(/[\s!"#$%&'()’“”*+,-./:;<=>?@[\\\]^_`{|}~～〜☆★♡♥♪♪【】「」]/g, '');
};

// --- 保存/復元ロジック (LocalStorage) ---

const STORAGE_KEY_WORKS = 'priceComparisonWorks';
const STORAGE_KEY_DISCOUNTS = 'priceComparisonDiscounts';

function saveData() {
    const sites = ['dlsite', 'fanza'];
    const worksData = { dlsite: [], fanza: [] };
    const discountsData = { dlsite: [], fanza: [] };

    try {
        sites.forEach(site => {
            // 作品データを収集
            document.querySelectorAll(`#${site}-items-container .work-item`).forEach(item => {
                worksData[site].push({
                    name: item.querySelector('.work-name').value.trim(),
                    price: item.querySelector('.work-price').value,
                    discount: item.querySelector('.work-discount').value,
                    bulkEligible: item.querySelector('.work-bulk-eligible').checked
                });
            });

            // 割引データを収集
            document.querySelectorAll(`#${site}-discounts-container .discount-item`).forEach(item => {
                const params = {};
                // data-属性からパラメータを復元
                Object.keys(item.dataset).forEach(key => {
                    if (key !== 'id' && key !== 'type' && key !== 'param_type') { 
                        params[key] = item.dataset[key];
                    }
                });
                // 特殊処理: typeパラメータの復元
                if (item.dataset.param_type) {
                    params.type = item.dataset.param_type;
                }

                discountsData[site].push({
                    name: item.querySelector('.font-semibold').textContent,
                    type: item.dataset.type,
                    params: params,
                    isActive: item.querySelector('.discount-active').checked // ★修正: チェック状態を保存
                });
            });
        });

        localStorage.setItem(STORAGE_KEY_WORKS, JSON.stringify(worksData));
        localStorage.setItem(STORAGE_KEY_DISCOUNTS, JSON.stringify(discountsData));

    } catch (e) {
        console.error("Failed to save data to LocalStorage:", e);
    }
}

function loadData(createWorkItemElement, createDiscountItemElement) {
    try {
        const worksData = JSON.parse(localStorage.getItem(STORAGE_KEY_WORKS));
        const discountsData = JSON.parse(localStorage.getItem(STORAGE_KEY_DISCOUNTS));

        if (worksData) {
            ['dlsite', 'fanza'].forEach(site => {
                const container = document.getElementById(`${site}-items-container`);
                if (worksData[site] && worksData[site].length > 0) {
                    const placeholder = container.querySelector('.work-placeholder');
                    if (placeholder) placeholder.remove();

                    worksData[site].forEach(work => {
                        const itemEl = createWorkItemElement(site, work.name, work.price, work.discount);
                        if (itemEl.querySelector('.work-bulk-eligible')) {
                            itemEl.querySelector('.work-bulk-eligible').checked = work.bulkEligible;
                        }
                        container.appendChild(itemEl);
                    });
                }
            });
        }

        if (discountsData) {
            ['dlsite', 'fanza'].forEach(site => {
                const container = document.getElementById(`${site}-discounts-container`);
                if (discountsData[site] && discountsData[site].length > 0) {
                    const placeholder = container.querySelector('.discount-placeholder');
                    if (placeholder) placeholder.remove();

                    discountsData[site].forEach(discount => {
                        const itemEl = createDiscountItemElement(discount);
                        // ★修正: チェック状態を復元
                        if (discount.isActive) {
                            itemEl.querySelector('.discount-active').checked = true;
                        }
                        container.appendChild(itemEl);
                    });
                }
            });
        }
        console.log("Data loaded from LocalStorage");
    } catch (e) {
        console.error("Failed to load data from LocalStorage:", e);
    }
}

// --- UI Logic ---
document.addEventListener('DOMContentLoaded', () => {

    initializeFirebase();

    // ★修正: 自動で「全作品割引」オプションをHTMLに追加 (HTML修正不要化)
    const discountTypeSelect = document.getElementById('reg-discount-type');
    if (discountTypeSelect && !discountTypeSelect.querySelector('option[value="per_item"]')) {
        const perItemOption = document.createElement('option');
        perItemOption.value = 'per_item';
        perItemOption.textContent = '全作品割引 (単価から)';
        discountTypeSelect.appendChild(perItemOption);
    }

    const setupBookmarklet = () => {
        const bookmarkletLink = document.getElementById('bookmarklet-link');
        if (!bookmarkletLink) return;

        let baseUrl = window.location.href.split('?')[0];
        if (baseUrl.endsWith('price_comparison.html')) {
            baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf('price_comparison.html'));
        }
        const comparisonUrl = new URL('price_comparison.html', baseUrl).href;

        // ★修正: 取得処理を少し堅牢化
        bookmarkletCode = `javascript:(() => { const URL = '${comparisonUrl}'; let title = document.title; let price_raw = ''; let discount_raw = ''; let site = ''; let errorMsg = null; const cleanPrice = (p) => p ? p.replace(/[^0-9]/g, '') : ''; const cleanDiscount = (d) => d ? d.replace(/[^0-9]/g, '') : ''; const DLFITE_DISCOUNT_SELECTOR = 'p.type_sale > span, .work_buy_content .type_sale'; const FANZA_DISCOUNT_SELECTOR = '.campaignBalloon__ttl, .priceList__sub--big'; try { if (location.hostname.includes('dlsite.com')) { site = 'dlsite'; const pElem = document.querySelector('.work_buy_content .price'); if(pElem) price_raw = pElem.innerText; const dElem = document.querySelector(DLFITE_DISCOUNT_SELECTOR); if(dElem) discount_raw = dElem.innerText; } else if (location.hostname.includes('dmm.co.jp')) { site = 'fanza'; const pElem = document.querySelector('.priceList__main'); if(pElem) price_raw = pElem.innerText; const dElem = document.querySelector(FANZA_DISCOUNT_SELECTOR); if(dElem) discount_raw = dElem.innerText; } } catch (e) { errorMsg = e.message; } const price = cleanPrice(price_raw); const discount = cleanDiscount(discount_raw); if (errorMsg) { alert('エラー: ' + errorMsg); } else { let params = new URLSearchParams(); params.set('title', title.replace(/\\\\|\\\\/g, '')); if (price) params.set('price', price); if (discount) params.set('discount', discount); if (site) params.set('site', site); window.open(URL + '?' + params.toString()); } })();`;
        
        bookmarkletLink.setAttribute('href', bookmarkletCode);
        bookmarkletLink.addEventListener('click', (e) => {
            e.preventDefault();
            alert('このボタンをクリックするのではなく、お使いのブラウザのブックマークバーに「ドラッグ＆ドロップ」してください。');
        });
    };
    
    setupBookmarklet();

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const loginError = document.getElementById('login-error');
            const loadingOverlay = document.getElementById('loading-overlay');

            signInWithEmailAndPassword(auth, email, password)
                .then(() => {
                    loginError.classList.add('hidden');
                    loadingOverlay.classList.remove('hidden');
                })
                .catch(() => {
                    loginError.textContent = 'メールアドレスまたはパスワードが違います。';
                    loginError.classList.remove('hidden');
                });
        });
    }

    const toastContainer = document.getElementById('toast-container');
    const showToast = (message, type = 'success') => {
        const toast = document.createElement('div');
        const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle';
        const colorClass = type === 'success' ? 'toast-success' : 'toast-error';
        toast.className = `toast ${colorClass}`;
        toast.innerHTML = `<i class="fas ${icon} icon"></i><span>${message}</span>`;
        toastContainer.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 3000);
    };

    const validateNumericInput = (e) => {
        const input = e.target;
        const max = parseFloat(input.max);
        if (input.value === '') return;
        let sanitizedValue = input.value.replace(/[^0-9]/g, '');
        if (sanitizedValue.length > 1) sanitizedValue = sanitizedValue.replace(/^0+/, '');
        let value = parseInt(sanitizedValue, 10);
        if (isNaN(value)) { input.value = ''; return; }
        if (!isNaN(max) && value > max) value = max;
        if (input.value !== String(value)) input.value = value;
    };

    const clampOnBlur = (e) => {
        const input = e.target;
        const min = parseFloat(input.min);
        let value = parseInt(input.value, 10);
        if (isNaN(value)) input.value = '';
        else if (!isNaN(min) && value < min) input.value = min;
    };
    
    // --- Modals ---
    const managementModal = document.getElementById('management-modal');
    const managementModalContent = document.getElementById('management-modal-content');
    const confirmModal = document.getElementById('confirm-modal');
    const confirmModalContent = document.getElementById('confirm-modal-content');
    const adSettingsModal = document.getElementById('ad-settings-modal');
    const bookmarkletCodeModal = document.getElementById('bookmarklet-code-modal');
    const bookmarkletCodeModalContent = document.getElementById('bookmarklet-code-modal-content');
    const bookmarkletCodeDisplay = document.getElementById('bookmarklet-code-display');
    const adSettingsModalContent = document.getElementById('ad-settings-modal-content');

    const showModal = (modal, content) => {
        modal.classList.remove('hidden');
        setTimeout(() => content.classList.add('modal-open'), 10);
    }
    const hideModal = (modal, content) => {
        content.classList.remove('modal-open');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }

    const showConfirm = (title, message) => {
        return new Promise(resolve => {
            document.getElementById('confirm-title').textContent = title;
            document.getElementById('confirm-message').innerHTML = message;
            showModal(confirmModal, confirmModalContent);
            
            const okHandler = () => { hideModal(confirmModal, confirmModalContent); cleanup(); resolve(true); };
            const cancelHandler = () => { hideModal(confirmModal, confirmModalContent); cleanup(); resolve(false); };
            const cleanup = () => {
                document.getElementById('confirm-ok').removeEventListener('click', okHandler);
                document.getElementById('confirm-cancel').removeEventListener('click', cancelHandler);
            }

            document.getElementById('confirm-ok').addEventListener('click', okHandler);
            document.getElementById('confirm-cancel').addEventListener('click', cancelHandler);
        });
    };

    const regTabDlsite = document.getElementById('reg-tab-dlsite');
    const regTabFanza = document.getElementById('reg-tab-fanza');
    const regFormDlsite = document.getElementById('reg-form-dlsite');
    const regFormFanza = document.getElementById('reg-form-fanza');
    let activeRegTab = 'dlsite';

    function switchRegTab(tab) {
        activeRegTab = tab;
        regTabDlsite.classList.toggle('border-blue-500', tab === 'dlsite');
        regTabDlsite.classList.toggle('text-blue-400', tab === 'dlsite');
        regTabDlsite.classList.toggle('reg-tab-active', tab === 'dlsite');
        regFormDlsite.classList.toggle('hidden', tab !== 'dlsite');
        regTabFanza.classList.toggle('border-red-500', tab === 'fanza');
        regTabFanza.classList.toggle('text-red-400', tab === 'fanza');
        regTabFanza.classList.toggle('reg-tab-active', tab === 'fanza');
        regFormFanza.classList.toggle('hidden', tab !== 'fanza');
    }
    switchRegTab('dlsite');
    
    const regWorkName = document.getElementById('reg-work-name');
    const suggestionsEl = document.getElementById('work-suggestions');
    const regWorkStatus = document.getElementById('reg-work-status');
    
    const checkDuplicate = (name) => {
        const normalized = normalizeName(name);
        if (!normalized) {
            regWorkStatus.innerHTML = '';
            return;
        }
        const currentSiteContainerId = `${activeRegTab}-items-container`;
        const isAlreadyInCurrentList = Array.from(document.querySelectorAll(`#${currentSiteContainerId} .work-name`)).some(input => normalizeName(input.value) === normalized);

        if(isAlreadyInCurrentList) {
            const siteName = activeRegTab === 'dlsite' ? 'DLsite' : 'FANZA';
            regWorkStatus.innerHTML = `<i class="fas fa-exclamation-circle text-orange-400 mr-2"></i>この作品は${siteName}リストに既に追加済みです。`;
            return;
        }
        
        const isInSelector = selectorWorks.some(work => normalizeName(work.name) === normalized);
        if(isInSelector) {
            regWorkStatus.innerHTML = '<i class="fas fa-exclamation-triangle text-yellow-400 mr-2"></i>セレクターに登録済みの作品です。';
            return;
        }
        
        regWorkStatus.innerHTML = '';
    };

    regWorkName.addEventListener('input', () => {
        const query = regWorkName.value.trim();
        const normalizedQuery = normalizeName(query);
        checkDuplicate(query);

        if (normalizedQuery.length < 2) {
            suggestionsEl.classList.add('hidden');
            return;
        }
        const suggestions = selectorWorks.filter(work => normalizeName(work.name).includes(normalizedQuery)).slice(0, 10);
        if (suggestions.length > 0) {
            suggestionsEl.innerHTML = suggestions.map(work => `
                <div class="suggestion-item p-2 hover:bg-gray-500 cursor-pointer flex items-center gap-2" data-name="${work.name}">
                   <img src="${work.imageUrl || 'https://placehold.co/40x40/1f2937/4b5563?text=?'}" class="w-8 h-8 object-cover rounded-sm flex-shrink-0">
                   <span class="text-sm truncate">${work.name}</span>
                </div>
            `).join('');
            suggestionsEl.classList.remove('hidden');
        } else {
            suggestionsEl.classList.add('hidden');
        }
    });

    suggestionsEl.addEventListener('click', (e) => {
        const item = e.target.closest('.suggestion-item');
        if (item) {
            regWorkName.value = item.dataset.name;
            suggestionsEl.classList.add('hidden');
            checkDuplicate(item.dataset.name);
        }
    });

    document.addEventListener('click', (e) => {
        if (!regWorkName.contains(e.target) && !suggestionsEl.contains(e.target)) {
            suggestionsEl.classList.add('hidden');
        }
    });

    const discountFieldsContainer = document.getElementById('reg-discount-fields');
    // ★修正: per_item テンプレートを追加
    const discountFieldTemplates = {
        bulk: `<div class="grid grid-cols-2 gap-2 text-sm"><div><label class="block text-xs text-gray-400">必要作品数</label><input type="number" data-key="count" value="3" min="1" max="999" class="numeric-input w-full bg-gray-800 rounded p-2 text-center"></div><div><label class="block text-xs text-gray-400">割引率 (%)</label><input type="number" data-key="percent" value="60" min="0" max="999" class="numeric-input w-full bg-gray-800 rounded p-2 text-center"></div></div>`,
        simple_coupon: `<div class="flex items-center gap-2 text-sm"><input type="number" data-key="value" value="1000" min="0" max="9999999" class="numeric-input w-24 bg-gray-800 rounded p-2 text-right"><select data-key="type" class="bg-gray-800 rounded p-2"><option value="yen">円引き</option><option value="percent">% OFF</option></select></div>`,
        conditional_coupon: `<div class="space-y-2 text-sm"><p>税込 <input type="number" data-key="price" value="1099" min="0" max="9999999" class="numeric-input w-24 bg-gray-800 rounded p-2 text-center"> 円までの作品が</p><p><input type="number" data-key="percent" value="20" min="0" max="100" class="numeric-input w-20 bg-gray-800 rounded p-2 text-center"> % OFF</p></div>`,
        bulk_coupon: `<div class="space-y-2 text-sm"><p><input type="number" data-key="count" value="5" min="1" max="999" class="numeric-input w-20 bg-gray-800 rounded p-2 text-center"> 作品以上で</p><p>合計から <input type="number" data-key="percent" value="20" min="0" max="100" class="numeric-input w-20 bg-gray-800 rounded p-2 text-center"> % OFF</p></div>`,
        per_item: `<div class="flex items-center gap-2 text-sm"><input type="number" data-key="value" value="10" min="0" max="9999999" class="numeric-input w-24 bg-gray-800 rounded p-2 text-right"><select data-key="type" class="bg-gray-800 rounded p-2"><option value="percent">% OFF (各作品)</option><option value="yen">円引き (各作品)</option></select></div>`
    };
    const renderDiscountFields = () => {
        discountFieldsContainer.innerHTML = discountFieldTemplates[discountTypeSelect.value] || '';
    }
    renderDiscountFields();

    const createWorkItemElement = (site, name, price, discount) => {
        uniqueId++;
        const isDlsite = site === 'dlsite';
        const color = isDlsite ? 'blue' : 'red';
        const safeName = name.replace(/"/g, '&quot;');
        const div = document.createElement('div');
        div.className = 'p-4 bg-gray-700/50 rounded-lg work-item space-y-3 new-item';
        div.dataset.id = `work-${uniqueId}`;
        div.innerHTML = `
            <div class="flex justify-between items-start">
                <input type="text" class="work-name w-full bg-transparent font-bold text-base focus:outline-none focus:bg-gray-800 rounded px-2 py-1" value="${safeName}" placeholder="作品名">
                <button class="remove-item-btn px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors flex-shrink-0 ml-2"><i class="fas fa-trash-alt text-xs"></i></button>
            </div>
            <div class="grid grid-cols-3 gap-3 text-sm">
                <div>
                    <label class="block text-xs text-gray-400">定価</label>
                    <input type="number" class="work-price numeric-input w-full bg-gray-800 border border-gray-600 rounded p-2 focus:ring-2 focus:ring-${color}-500 text-right" value="${price}" min="0" max="9999999">
                </div>
                <div>
                    <label class="block text-xs text-gray-400">割引(%)</label>
                    <input type="number" class="work-discount numeric-input w-full bg-gray-800 border border-gray-600 rounded p-2 focus:ring-2 focus:ring-${color}-500 text-right" value="${discount}" min="0" max="100">
                </div>
                <div>
                    <label class="block text-xs text-gray-400">割引後</label>
                    <input type="text" class="final-price w-full bg-transparent border-none rounded p-2 text-right font-semibold" value="¥0" readonly>
                </div>
            </div>
            <div>
                <label title="まとめ買い対象" class="flex items-center cursor-pointer text-sm">
                    <input type="checkbox" class="work-bulk-eligible h-5 w-5 rounded bg-gray-600 text-green-500 border-gray-500 focus:ring-green-600 mr-2">
                    <span>まとめ買い割引の対象</span>
                </label>
            </div>`;

        const priceInput = div.querySelector('.work-price');
        const discountInput = div.querySelector('.work-discount');
        const finalPriceInput = div.querySelector('.final-price');
        const updateItemFinalPrice = () => {
            const p = parseInt(priceInput.value, 10) || 0;
            const d = parseInt(discountInput.value, 10) || 0;
            const finalPrice = Math.round(p * (1 - d / 100));
            finalPriceInput.value = `¥${finalPrice.toLocaleString()}`;
        };
        [priceInput, discountInput].forEach(input => {
            input.addEventListener('input', (e) => { validateNumericInput(e); updateItemFinalPrice(); });
            input.addEventListener('blur', (e) => { clampOnBlur(e); updateItemFinalPrice(); saveData(); });
        });
        div.querySelector('.work-name').addEventListener('blur', saveData);
        div.querySelector('.work-bulk-eligible').addEventListener('change', saveData);
        div.querySelector('.remove-item-btn').addEventListener('click', () => { div.remove(); saveData(); updateUI(); });
        updateItemFinalPrice();
        return div;
    };

    const createDiscountItemElement = (data) => {
        uniqueId++;
        const div = document.createElement('div');
        div.className = 'p-3 bg-gray-700/50 rounded-lg discount-item new-item';
        div.dataset.id = `discount-${uniqueId}`;
        div.dataset.type = data.type;
        
        // ★修正: params を展開 (typeキーの衝突回避)
        for (const key in data.params) { 
            if (key === 'type') {
                div.dataset.param_type = data.params[key]; 
            } else {
                div.dataset[key] = data.params[key]; 
            }
        }

        let details = '';
        switch(data.type) {
            case 'bulk': details = `${data.params.count}点以上で${data.params.percent}% OFF`; break;
            case 'simple_coupon': details = `${data.params.value}${data.params.type === 'yen' ? '円引' : '% OFF'}`; break;
            case 'conditional_coupon': details = `税込${data.params.price}円まで${data.params.percent}% OFF`; break;
            case 'bulk_coupon': details = `${data.params.count}点以上で合計${data.params.percent}% OFF`; break;
            case 'per_item': details = `全作品 ${data.params.value}${data.params.type === 'yen' ? '円引' : '% OFF'}`; break;
        }
        div.innerHTML = `
            <div class="flex items-center justify-between">
                <label class="flex items-center cursor-pointer flex-grow">
                    <input type="checkbox" class="discount-active h-5 w-5 rounded bg-gray-600 text-green-500 border-gray-500 focus:ring-green-600 mr-3">
                    <div><p class="font-semibold">${data.name}</p><p class="text-xs text-gray-400">${details}</p></div>
                </label>
                <button class="remove-discount-btn px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors ml-2"><i class="fas fa-trash-alt text-xs"></i></button>
            </div>`;
        div.querySelector('.discount-active').addEventListener('change', () => updateUI());
        div.querySelector('.remove-discount-btn').addEventListener('click', () => { div.remove(); saveData(); updateUI(); });
        return div;
    };

    loadData(createWorkItemElement, createDiscountItemElement);

    const setupEventListeners = () => {
        const debugModal = document.getElementById('debug-modal');
        const debugModalContent = document.getElementById('debug-modal-content');
        const debugModalDisplay = document.getElementById('debug-modal-display');

        document.getElementById('debug-fab')?.addEventListener('click', () => {
            debugModalDisplay.innerHTML = `
                <p><strong>App Version:</strong> v_price_comp (Fixed)</p>
                <p><strong>Sync ID:</strong> ${syncId || 'N/A'}</p>
                <p><strong>User ID (short):</strong> ${currentUser ? currentUser.uid.substring(0, 10) + '...' : 'N/A'}</p>
            `;
            showModal(debugModal, debugModalContent);
        });
        document.getElementById('debug-modal-close')?.addEventListener('click', () => hideModal(debugModal, debugModalContent));
        debugModal?.addEventListener('click', (e) => {
            if (e.target === debugModal) hideModal(debugModal, debugModalContent);
        });

        document.addEventListener('applyBookmarkletData', (e) => {
            const { title, price, discount, site } = e.detail;
            if (site === 'dlsite' || site === 'fanza') {
                switchRegTab(site);
            }
            const dlsiteTab = document.getElementById('reg-tab-dlsite');
            const activeSite = (dlsiteTab && dlsiteTab.classList.contains('reg-tab-active')) ? 'dlsite' : 'fanza';
            const targetSite = (site === 'dlsite' || site === 'fanza') ? site : activeSite;

            if (title) {
                const workNameInput = document.getElementById('reg-work-name');
                if (workNameInput) {
                    workNameInput.value = title;
                    workNameInput.focus();
                }
            }
            if (price) {
                const priceInput = document.getElementById(`reg-price-${targetSite}`);
                if (priceInput) priceInput.value = price;
            }
            if (discount) {
                const discountInput = document.getElementById(`reg-discount-${targetSite}`);
                if (discountInput) discountInput.value = discount;
            }
        });

        regTabDlsite.addEventListener('click', () => { switchRegTab('dlsite'); checkDuplicate(regWorkName.value); });
        regTabFanza.addEventListener('click', () => { switchRegTab('fanza'); checkDuplicate(regWorkName.value); });
        discountTypeSelect.addEventListener('change', renderDiscountFields);
        document.getElementById('filter-input').addEventListener('input', updateUI);
        document.getElementById('compare-btn').addEventListener('click', updateUI);
        
        document.body.addEventListener('input', e => { if (e.target.matches('.numeric-input')) validateNumericInput(e); });
        document.body.addEventListener('blur', e => { if (e.target.matches('.numeric-input')) clampOnBlur(e); }, true);

        document.getElementById('add-to-list-btn').addEventListener('click', () => {
            const name = document.getElementById('reg-work-name').value;
            if (!name.trim()) { showToast('作品名を入力してください。', 'error'); return; }
            
            const normalizedName = normalizeName(name);
            const site = activeRegTab;
            const currentSiteContainerId = `${site}-items-container`;
            const isAlreadyInCurrentList = Array.from(document.querySelectorAll(`#${currentSiteContainerId} .work-name`)).some(input => normalizeName(input.value) === normalizedName);

            if (isAlreadyInCurrentList) {
                const siteName = site === 'dlsite' ? 'DLsite' : 'FANZA';
                showToast(`この作品は${siteName}リストに既に追加済みです。`, 'error');
                return;
            }

            const price = document.getElementById(`reg-price-${site}`).value;
            const discount = document.getElementById(`reg-discount-${site}`).value;
            if (!price && !discount) { showToast(`${site === 'dlsite' ? 'DLsite' : 'FANZA'}の定価か割引率を入力してください。`, 'error'); return; }
            
            const container = document.getElementById(`${site}-items-container`);
            const placeholder = container.querySelector('.work-placeholder');
            if (placeholder) placeholder.remove();
            container.appendChild(createWorkItemElement(site, name, price, discount));
            saveData();
            
            ['reg-work-name', 'reg-price-dlsite', 'reg-discount-dlsite', 'reg-price-fanza', 'reg-discount-fanza'].forEach(id => document.getElementById(id).value = '');
            regWorkStatus.innerHTML = '';
            showToast(`「${name}」をリストに追加しました。`);
        });

        document.getElementById('add-discount-btn').addEventListener('click', () => {
            const name = document.getElementById('reg-discount-name').value.trim();
            if (!name) { showToast('割引名を入力してください。', 'error'); return; }
            const site = document.querySelector('input[name="reg-discount-site"]:checked').value;
            const type = discountTypeSelect.value;
            const params = {};
            discountFieldsContainer.querySelectorAll('[data-key]').forEach(input => params[input.dataset.key] = input.value);
            const container = document.getElementById(`${site}-discounts-container`);
            const placeholder = container.querySelector('.discount-placeholder');
            if (placeholder) placeholder.remove();
            container.appendChild(createDiscountItemElement({ name, type, params }));
            saveData();
            document.getElementById('reg-discount-name').value = '';
            showToast(`割引「${name}」を追加しました。`);
        });

        document.getElementById('management-tools-fab').addEventListener('click', () => showModal(managementModal, managementModalContent));
        document.getElementById('management-modal-close').addEventListener('click', () => hideModal(managementModal, managementModalContent));
        managementModal.addEventListener('click', (e) => {
            if (e.target === managementModal) hideModal(managementModal, managementModalContent);
        });
        
        document.getElementById('ad-settings-fab').addEventListener('click', () => showModal(adSettingsModal, adSettingsModalContent));
        document.getElementById('ad-settings-modal-close').addEventListener('click', () => hideModal(adSettingsModal, adSettingsModalContent));
        adSettingsModal.addEventListener('click', (e) => {
            if (e.target === adSettingsModal) hideModal(adSettingsModal, adSettingsModalContent);
        });

        const copyBtn = document.getElementById('copy-bookmarklet-btn');
        const showBtn = document.getElementById('show-bookmarklet-btn');

        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(bookmarkletCode).then(() => {
                    showToast('ブックマークレットのコードをコピーしました。');
                }).catch(err => {
                    showToast('コピーに失敗しました。手動でコピーしてください。', 'error');
                });
            });
        }

        if (showBtn && bookmarkletCodeModal && bookmarkletCodeDisplay) {
            showBtn.addEventListener('click', () => {
                bookmarkletCodeDisplay.value = bookmarkletCode;
                showModal(bookmarkletCodeModal, bookmarkletCodeModalContent); 
                bookmarkletCodeDisplay.select(); 
            });
        }

        document.getElementById('bookmarklet-code-modal-close').addEventListener('click', () => hideModal(bookmarkletCodeModal, bookmarkletCodeModalContent));
        bookmarkletCodeModal.addEventListener('click', (e) => {
            if (e.target === bookmarkletCodeModal) hideModal(bookmarkletCodeModal, bookmarkletCodeModalContent);
        });
        document.querySelectorAll('input[name="ad_type"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                document.getElementById('ad-period-container').style.display = e.target.value === 'ranking' ? 'block' : 'none';
            });
        });
        document.getElementById('save-ad-settings-btn').addEventListener('click', () => {
            saveAndReloadAd();
            hideModal(adSettingsModal, adSettingsModalContent);
            showToast('広告設定を保存しました。');
        });

        document.getElementById('modal-reset-dlsite-btn').addEventListener('click', async () => {
            const worksCount = document.querySelectorAll('#dlsite-items-container .work-item').length;
            const discountsCount = document.querySelectorAll('#dlsite-discounts-container .discount-item').length;
            if (worksCount === 0 && discountsCount === 0) {
                showToast('DLsiteリストにリセットする項目がありません。', 'error');
                return;
            }
            if (await showConfirm('DLsiteリストのリセット', 'DLsiteの作品リストと割引リストをすべてクリアしますか？')) {
                document.getElementById('dlsite-items-container').innerHTML = '<p class="text-sm text-gray-500 work-placeholder">作品を登録すると表示されます。</p>';
                document.getElementById('dlsite-discounts-container').innerHTML = '<p class="text-sm text-gray-500 discount-placeholder">割引を登録すると表示されます。</p>';
                saveData();
                updateUI();
                showToast('DLsiteのリストをリセットしました。');
            }
        });
        document.getElementById('modal-reset-fanza-btn').addEventListener('click', async () => {
            const worksCount = document.querySelectorAll('#fanza-items-container .work-item').length;
            const discountsCount = document.querySelectorAll('#fanza-discounts-container .discount-item').length;
            if (worksCount === 0 && discountsCount === 0) {
                showToast('FANZAリストにリセットする項目がありません。', 'error');
                return;
            }
            if (await showConfirm('FANZAリストのリセット', 'FANZAの作品リストと割引リストをすべてクリアしますか？')) {
                document.getElementById('fanza-items-container').innerHTML = '<p class="text-sm text-gray-500 work-placeholder">作品を登録すると表示されます。</p>';
                document.getElementById('fanza-discounts-container').innerHTML = '<p class="text-sm text-gray-500 discount-placeholder">割引を登録すると表示されます。</p>';
                saveData();
                updateUI();
                showToast('FANZAのリストをリセットしました。');
            }
        });
        document.getElementById('modal-reset-all-btn').addEventListener('click', async () => {
                const totalItems = document.querySelectorAll('.work-item, .discount-item').length;
                if(totalItems === 0) {
                showToast('リセットする項目がありません。', 'error');
                return;
                }
            if (await showConfirm('全体の完全リセット', '<strong>すべてのサイト</strong>の作品と割引リストをクリアします。よろしいですか？')) {
                ['dlsite', 'fanza'].forEach(site => {
                    document.getElementById(`${site}-items-container`).innerHTML = '<p class="text-sm text-gray-500 work-placeholder">作品を登録すると表示されます。</p>';
                    document.getElementById(`${site}-discounts-container`).innerHTML = '<p class="text-sm text-gray-500 discount-placeholder">割引を登録すると表示されます。</p>';
                });
                ownedItems.clear();
                saveData();
                updateUI();
                showToast('すべてのデータをリセットしました。', 'error');
            }
        });

            document.getElementById('toggle-owned-all').addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            document.querySelectorAll('#comparison-table-body .owned-checkbox').forEach(cb => {
                if (isChecked) ownedItems.add(cb.dataset.name);
                else ownedItems.delete(cb.dataset.name);
            });
            updateUI();
        });
    };

    // ★★★ 修正: DLsite仕様準拠 (セット割優先・個別割引破棄 -> クーポン適用) ★★★
    const calculateSiteTotal = (workItems, site) => {
        let comparisonDetails = [];

        // 1. クーポン情報の取得
        const selectedDiscounts = Array.from(document.querySelectorAll(`#${site}-discounts-container .discount-active:checked`))
            .map(cb => {
                const item = cb.closest('.discount-item');
                return { 
                    ...item.dataset, 
                    typeParam: item.dataset.param_type || item.dataset.type, 
                    name: item.querySelector('.font-semibold').textContent 
                };
            });

        // 割引タイプの分類
        const perItemDiscounts = selectedDiscounts.filter(d => d.type === 'per_item');
        const simpleCoupons = selectedDiscounts.filter(d => d.type === 'simple_coupon' || d.type === 'conditional_coupon');
        // まとめ買い: 割引率が高い順、かつ必要数が多い順にソート（より条件の厳しい/お得なセットを優先）
        const bulkDiscounts = selectedDiscounts.filter(d => d.type === 'bulk')
            .sort((a, b) => {
                const rateA = parseFloat(a.percent || a.rate);
                const rateB = parseFloat(b.percent || b.rate);
                const countA = parseInt(a.count || 0);
                const countB = parseInt(b.count || 0);
                if (rateA !== rateB) return rateB - rateA; // 割引率高い順
                return countB - countA; // 同じなら個数多い順
            });
        const bulkCouponDiscounts = selectedDiscounts.filter(d => d.type === 'bulk_coupon');

        // --- Step 1: セット割 (まとめ買い) の適用判定 ---
        // まず全アイテムを「計算用オブジェクト」に変換
        let processingItems = workItems.map((work, index) => ({
            ...work,
            originalIndex: index,
            basePrice: work.price, // 初期値は定価
            tempPrice: work.price, // 計算途中価格
            appliedBulkName: null, // 適用されたセット割名
            isBulkApplied: false   // セット割が適用されたか
        }));

        // まとめ買い対象のアイテムを抽出
        let bulkEligibleList = processingItems.filter(p => p.bulkEligible);
        // 安い順にソート（一般的に安いものからセット適用、あるいは組み合わせ自由だがここでは価格順で処理）
        bulkEligibleList.sort((a, b) => a.basePrice - b.basePrice);

        // セット割を適用していく
        bulkDiscounts.forEach(bulk => {
            const count = parseInt(bulk.count || 3, 10);
            const percent = parseFloat(bulk.percent || bulk.rate || 0);

            // 対象リストに残っている数が、セット必要数を満たしている間繰り返す
            while (bulkEligibleList.length >= count) {
                // リストから必要数分を取り出す (消費する)
                const chunk = bulkEligibleList.splice(0, count);
                
                chunk.forEach(item => {
                    // ★重要: 定価(basePrice) から セット割引率を適用。元の個別割引は無視される。
                    item.tempPrice = Math.floor(item.basePrice * (1 - percent / 100));
                    item.appliedBulkName = bulk.name;
                    item.isBulkApplied = true;
                });
            }
        });

        // セット割に漏れたアイテム（または対象外アイテム）は、通常の「個別割引」を適用する
        processingItems.forEach(item => {
            if (!item.isBulkApplied) {
                // セット割が適用されていない場合のみ、元の個別割引(%)を使う
                item.tempPrice = Math.floor(item.basePrice * (1 - item.discount / 100));
            }
        });

        // --- Step 2: クーポン (Per Item & Simple) の適用 ---
        // processingItems は元の順序ではないので、originalIndex順に戻す必要はないが、comparisonDetailsは元の順序で作る
        
        // originalIndex順に並べ直してループ（結果表示の並び順維持のため）
        processingItems.sort((a, b) => a.originalIndex - b.originalIndex);

        processingItems.forEach(item => {
            let currentPrice = item.tempPrice; // セット割適用後 または セール適用後の価格
            let appliedDiscountText = item.appliedBulkName || 'なし';

            // 2-1. 全作品一律割引 (Per Item)
            perItemDiscounts.forEach(disc => {
                const val = parseFloat(disc.value || 0);
                const unitType = disc.typeParam; 
                if (unitType === 'yen') {
                    currentPrice = Math.max(0, currentPrice - val);
                } else {
                    currentPrice = Math.floor(currentPrice * (1 - val / 100));
                }
            });

            // 2-2. 個別クーポン (Simple/Conditional)
            // ※セット割適用後でもクーポンが使える仕様と仮定
            let bestDiscountAmt = 0;
            let bestCouponName = null;

            simpleCoupons.forEach(coupon => {
                const rate = parseFloat(coupon.value || coupon.percent || 0);
                const threshold = parseFloat(coupon.price || coupon.threshold || 0);
                const couponType = coupon.type;
                const unitType = coupon.typeParam;

                let applies = false;
                if (couponType === 'simple_coupon') {
                    applies = true;
                } else if (couponType === 'conditional_coupon' && currentPrice <= threshold) {
                    applies = true;
                }

                if (applies) {
                    let currentDiscountAmt = 0;
                    if (unitType === 'yen') {
                        currentDiscountAmt = rate;
                    } else {
                        currentDiscountAmt = currentPrice * (rate / 100);
                    }

                    if (currentDiscountAmt > bestDiscountAmt) {
                        bestDiscountAmt = currentDiscountAmt;
                        bestCouponName = coupon.name;
                    }
                }
            });

            if (bestCouponName) {
                currentPrice = Math.max(0, currentPrice - bestDiscountAmt);
                // 表示テキストの更新
                if (item.isBulkApplied) {
                    appliedDiscountText = `${item.appliedBulkName} + ${bestCouponName}`;
                } else {
                    appliedDiscountText = bestCouponName;
                }
            }

            comparisonDetails.push({
                name: item.name,
                finalPrice: currentPrice,
                originalPrice: item.basePrice,
                appliedDiscount: appliedDiscountText
            });
        });

        // --- Step 3: 合計金額の計算と全体クーポン ---
        let total = comparisonDetails.reduce((sum, item) => sum + item.finalPrice, 0);

        bulkCouponDiscounts.forEach(coupon => {
            const count = parseInt(coupon.count || 1, 10);
            const percent = parseFloat(coupon.percent || 0);

            if (workItems.length >= count) {
                const discountAmount = Math.floor(total * (percent / 100));
                total = Math.max(0, total - discountAmount);
            }
        });

        return { total, comparisonDetails, bulkCouponDiscounts };
    };

    const updateUI = () => {
        const getSiteData = (site) => Array.from(document.querySelectorAll(`#${site}-items-container .work-item`)).map(item => ({
            name: item.querySelector('.work-name').value.trim(),
            price: parseInt(item.querySelector('.work-price').value, 10) || 0,
            discount: parseInt(item.querySelector('.work-discount').value, 10) || 0,
            bulkEligible: item.querySelector('.work-bulk-eligible').checked
        })).filter(item => item.name);

        const dlsiteAllItems = getSiteData('dlsite');
        const fanzaAllItems = getSiteData('fanza');

        const dlsiteResult = calculateSiteTotal(dlsiteAllItems, 'dlsite');
        const fanzaResult = calculateSiteTotal(fanzaAllItems, 'fanza');
        
        // 詳細計算結果を取得
        const dlsitePriceDetails = dlsiteResult.comparisonDetails;
        const fanzaPriceDetails = fanzaResult.comparisonDetails;

        const dlsitePriceMap = new Map(dlsitePriceDetails.map(item => [normalizeName(item.name), item]));
        const fanzaPriceMap = new Map(fanzaPriceDetails.map(item => [normalizeName(item.name), item]));

        const itemMap = new Map();
        dlsiteAllItems.forEach(item => {
            const key = normalizeName(item.name);
            if (!itemMap.has(key)) itemMap.set(key, { name: item.name });
            itemMap.get(key).dlsite = item;
        });
        fanzaAllItems.forEach(item => {
            const key = normalizeName(item.name);
            if (!itemMap.has(key)) itemMap.set(key, { name: item.name });
            itemMap.get(key).fanza = item;
        });

        const allItems = Array.from(itemMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        const filterText = document.getElementById('filter-input').value;
        const filteredItems = filterText ? allItems.filter(item => normalizeName(item.name).includes(normalizeName(filterText))) : allItems;
        const tableBody = document.getElementById('comparison-table-body');

        if (allItems.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-gray-500">作品を登録して「比較を実行する」ボタンを押してください。</td></tr>`;
                document.getElementById('dlsite-total').textContent = '¥0';
                document.getElementById('fanza-total').textContent = '¥0';
                document.getElementById('optimal-total').textContent = '¥0';
                return;
        }
        
        tableBody.innerHTML = '';
        
        // 再計算用リスト (既読除外)
        let dlsitePurchaseList = [];
        let fanzaPurchaseList = [];

        filteredItems.forEach(item => {
            const normalizedName = normalizeName(item.name);
            item.owned = ownedItems.has(normalizedName);
            item.isDuplicateInSelector = selectorWorks.some(w => normalizeName(w.name) === normalizedName);
            item.onBothSites = item.dlsite && item.fanza;
            
            const dlsiteInfo = item.dlsite ? dlsitePriceMap.get(normalizeName(item.dlsite.name)) : null;
            const fanzaInfo = item.fanza ? fanzaPriceMap.get(normalizeName(item.fanza.name)) : null;
            
            const dlsiteFinalPrice = dlsiteInfo ? dlsiteInfo.finalPrice : null;
            const fanzaFinalPrice = fanzaInfo ? fanzaInfo.finalPrice : null;

            const dlsiteSimpleDiscount = item.dlsite ? item.dlsite.discount : 0;
            const fanzaSimpleDiscount = item.fanza ? item.fanza.discount : 0;
            
            let bestChoice = 'N/A';
            if (dlsiteFinalPrice !== null && (fanzaFinalPrice === null || dlsiteFinalPrice <= fanzaFinalPrice)) bestChoice = 'DLsite';
            else if (fanzaFinalPrice !== null) bestChoice = 'FANZA';
            
            if (!item.owned) {
                if (bestChoice === 'DLsite' && item.dlsite) dlsitePurchaseList.push(item.dlsite);
                else if (bestChoice === 'FANZA' && item.fanza) fanzaPurchaseList.push(item.fanza);
            }

            const dlsitePriceHtml = dlsiteFinalPrice !== null ?
                `<strong>¥${Math.round(dlsiteFinalPrice).toLocaleString()}</strong>
                    <span class="text-xs text-gray-400">(${dlsiteSimpleDiscount}%)</span>
                    ${(dlsiteInfo.appliedDiscount && dlsiteInfo.appliedDiscount !== 'なし') ? `<br><span class="text-xs text-cyan-400">${dlsiteInfo.appliedDiscount}</span>` : ''}`
                : '-';
            
            const fanzaPriceHtml = fanzaFinalPrice !== null ?
                `<strong>¥${Math.round(fanzaFinalPrice).toLocaleString()}</strong>
                    <span class="text-xs text-gray-400">(${fanzaSimpleDiscount}%)</span>
                    ${(fanzaInfo.appliedDiscount && fanzaInfo.appliedDiscount !== 'なし') ? `<br><span class="text-xs text-cyan-400">${fanzaInfo.appliedDiscount}</span>` : ''}`
                : '-';

            const row = document.createElement('tr');
            row.className = 'bg-gray-800 border-b border-gray-700 hover:bg-gray-700/50 transition-colors';
            row.innerHTML = `
                <td class="p-3"><label class="flex items-center"><input type="checkbox" data-name="${normalizedName}" class="owned-checkbox h-4 w-4 rounded bg-gray-600 text-cyan-500 border-gray-500 focus:ring-cyan-600" ${item.owned ? 'checked' : ''}></label></td>
                <td class="p-3 font-medium flex items-center">
                    <span>${item.name}</span>
                    ${item.onBothSites ? '<i class="fas fa-exchange-alt text-cyan-400 ml-2" title="両サイトに登録されています"></i>' : ''}
                    ${item.isDuplicateInSelector ? '<i class="fas fa-exclamation-triangle text-yellow-400 ml-2" title="セレクターに登録済みの作品です"></i>' : ''}
                </td>
                <td class="p-3 text-right ${bestChoice === 'DLsite' ? 'result-item-highlight' : ''}">${dlsitePriceHtml}</td>
                <td class="p-3 text-right ${bestChoice === 'FANZA' ? 'result-item-highlight' : ''}">${fanzaPriceHtml}</td>
                <td class="p-3 font-bold text-center ${bestChoice === 'DLsite' ? 'text-blue-400' : bestChoice === 'FANZA' ? 'text-red-400' : ''}">${(dlsiteFinalPrice !== null && fanzaFinalPrice !== null) ? bestChoice : '<span class="text-amber-400">専売</span>'}</td>`;
            tableBody.appendChild(row);
        });

        // 最終合計の再計算 (既読を除いたリストで計算し直す)
        const dlsiteFinalResult = calculateSiteTotal(dlsitePurchaseList, 'dlsite');
        const fanzaFinalResult = calculateSiteTotal(fanzaPurchaseList, 'fanza');
        
        document.getElementById('dlsite-total').textContent = `¥${Math.round(dlsiteFinalResult.total).toLocaleString()}`;
        document.getElementById('fanza-total').textContent = `¥${Math.round(fanzaFinalResult.total).toLocaleString()}`;
        document.getElementById('optimal-total').textContent = `¥${Math.round(dlsiteFinalResult.total + fanzaFinalResult.total).toLocaleString()}`;
        
        tableBody.querySelectorAll('.owned-checkbox').forEach(cb => cb.addEventListener('change', (e) => {
            if (e.target.checked) ownedItems.add(e.target.dataset.name);
            else ownedItems.delete(e.target.dataset.name);
            updateUI(); 
        }));
    };

    // --- Ad Logic ---
    const defaultAdSettings = { showAd: true, type: 'ranking', site: 'maniax', period: 'week' };
    const topAdBanner = document.getElementById('top-ad-banner');
    const leftAside = document.getElementById('left-aside');

    const applyAdVisibility = (isVisible) => {
        topAdBanner.classList.toggle('hidden', !isVisible);
        if (window.innerWidth >= 1024) { 
            leftAside.style.top = isVisible ? '160px' : '8px';
        } else {
            leftAside.style.top = ''; 
        }
    };
    
    const generateAndLoadAdScript = (settings) => {
        const container = document.getElementById('ad-script-container');
        container.innerHTML = ''; 

        if (!settings.showAd) {
            return; 
        }

        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.minHeight = '120px'; 
        iframe.scrolling = 'no';
        iframe.setAttribute('title', 'DLsite Advertisement'); 

        container.appendChild(iframe);

        const adSettings = {
            base: "https://www.dlsite.com/",
            type: settings.type,
            site: settings.site,
            query: {},
            title: settings.type === 'ranking' ? "ランキング" : "新着作品",
            display: "horizontal",
            detail: "1",
            column: "v",
            image: "small",
            count: "5", 
            wrapper: "0", 
            autorotate: true,
            aid: "workassist"
        };
        
        if (settings.type === 'ranking') {
            adSettings.query.period = settings.period;
        }

        const iframeContent = `
            <html>
            <head>
                <style>
                    body { margin: 0; padding: 0; overflow-x: auto; overflow-y: hidden; }
                    body::-webkit-scrollbar { height: 6px; }
                    body::-webkit-scrollbar-track { background: transparent; }
                    body::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 3px; }
                    body::-webkit-scrollbar-thumb:hover { background: #6b7280; }
                    .blogparts_container_Hor { white-space: nowrap; padding-bottom: 8px; }
                </style>
            </head>
            <body>
                <script type="text/javascript">
                    var blogparts = ${JSON.stringify(adSettings)};
                <\/script>
                <script type="text/javascript" src="https://www.dlsite.com/js/blogparts.js" charset="UTF-8"><\/script>
            </body>
            </html>
        `;

        const iframeDoc = iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(iframeContent);
        iframeDoc.close();
    };

    const saveAndReloadAd = () => {
        const settings = {
            showAd: document.getElementById('ad_visibility').checked,
            type: document.querySelector('input[name="ad_type"]:checked').value,
            site: document.getElementById('ad_site').value,
            period: document.getElementById('ad_period').value
        };
        localStorage.setItem('adSettings', JSON.stringify(settings));
        applyAdVisibility(settings.showAd);
        generateAndLoadAdScript(settings);
    };

    const loadAdSettings = () => {
        const saved = localStorage.getItem('adSettings');
        const settings = saved ? JSON.parse(saved) : defaultAdSettings;

        document.getElementById('ad_visibility').checked = settings.showAd;
        document.querySelector(`input[name="ad_type"][value="${settings.type}"]`).checked = true;
        
        const siteSelect = document.getElementById('ad_site');
        if (siteSelect.querySelector(`option[value="${settings.site}"]`)) {
            siteSelect.value = settings.site;
        }

        const periodSelect = document.getElementById('ad_period');
        if (periodSelect.querySelector(`option[value="${settings.period}"]`)) {
            periodSelect.value = settings.period;
        }
        
        document.getElementById('ad-period-container').style.display = settings.type === 'ranking' ? 'block' : 'none';
        
        applyAdVisibility(settings.showAd);
        generateAndLoadAdScript(settings);
    };
    
    window.addEventListener('resize', () => {
        const settings = JSON.parse(localStorage.getItem('adSettings') || JSON.stringify(defaultAdSettings));
        applyAdVisibility(settings.showAd);
    });
    
    loadAdSettings();
    setupEventListeners();
});