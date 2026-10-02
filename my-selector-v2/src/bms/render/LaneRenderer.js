// src/bms/render/LaneRenderer.js
// レーン(譜面)キャンバスの描画。React / 再生状態には依存せず、1フレームぶんの描画に必要な値を引数で受け取る。
// 描画用のキャッシュ(静的な板・レーン単位のグラデーション・READY/GO の文字)はインスタンスに持つ。
import { VISIBILITY_MODES, PMS_LANE_COLORS } from '../constants';
import { findStartIndex, getBeatFromTime } from '../logic/utils';
import { MAX_LANES, displayLanes, layoutLanes, laneNoteColor, laneBgColor } from './laneLayout';

const JUDGE_TEXT = {
    pg: ['PGREAT', '#22d3ee'], gr: ['GREAT', '#fde047'], gd: ['GOOD', '#4ade80'],
    bd: ['BAD', '#fb923c'], poor: ['POOR', '#94a3b8'], epoor: ['空POOR', '#64748b'],
};

export class LaneRenderer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.grad = { key: '' };              // レーン単位のグラデーション・色(ジオメトリが変わったときだけ再構築)
        this.board = { key: '', canvas: null }; // 静的な板(背景/レーン/区切り線/判定線)のオフスクリーン
        this.readyText = null;                // READY/GO 演出(shadowBlur は最重量級なのでオフスクリーンに1回だけ焼く)
        // ★軽量化: 毎フレームの配列割り当てを避けるための再利用バッファ
        this.laneX = new Array(MAX_LANES).fill(0);   // laneX[index] = 板内での左端X (boardX 相対)
        this.laneW = new Array(MAX_LANES).fill(0);   // laneW[index] = レーン幅
        this.activeLanes = new Array(MAX_LANES).fill(false);
    }

    /** 描画先の canvas を設定する(PC/モバイルで要素が差し替わるとキャッシュを作り直す) */
    attach(canvas) {
        if (canvas === this.canvas) return;
        this.canvas = canvas;
        this.ctx = null;
        this.invalidate();
    }

    /** キャッシュ(板・グラデーション)を次フレームで作り直させる */
    invalidate() { this.grad.key = ''; this.board.key = ''; }

    /** READY/GO の文字をオフスクリーンに焼く(初回描画時のヒッチを避けるためマウント時に呼ぶ) */
    prepareReadyText() {
        if (this.readyText) return this.readyText;
        const mk = (text, font, fill, glow, blur) => {
            const c = document.createElement('canvas');
            c.width = 480; c.height = 140;
            const cx = c.getContext('2d');
            cx.shadowColor = glow; cx.shadowBlur = blur;
            cx.fillStyle = fill; cx.font = font;
            cx.textAlign = 'center'; cx.textBaseline = 'middle';
            cx.fillText(text, 240, 70);
            return c;
        };
        return (this.readyText = {
            GO: mk('GO!!', 'bold italic 80px sans-serif', '#ff3333', '#ff0000', 30),
            READY: mk('READY...', 'bold italic 60px sans-serif', '#ffffff', '#00ccff', 20),
        });
    }

    /**
     * 1フレーム描画する。
     * @param {object} f
     *   width/height(CSS px), dpr, song(parseBMS の結果 or null), objects(オプション適用済みのオブジェクト), currentTime(秒),
     *   now(performance.now), hiSpeed, visMode, suddenPlus, hiddenPlus, lift, boardOpacity, laneOpacity,
     *   isMobile, is2P, simpleFx(lite の演出簡易化), laneMute(レーン別ミュート),
     *   judge({ kind, deltaMs, age } or null: プレイモードの判定文字), ready('READY'|'GO'|null), liveResult(Tab 成績 or null)
     * @returns {boolean[]} レーン別の「光らせる」状態(LN 押下中・ノーツ通過直後)。再利用配列なので次フレームまでに読むこと
     */
    draw(f) {
        const canvas = this.canvas;
        if (!this.ctx) this.ctx = canvas.getContext('2d', { alpha: true }); // ★BGA が透けるよう alpha:true
        const ctx = this.ctx;
        const { width, height, dpr, song } = f;
        // ★軽量化: canvas.width/height は整数なので、比較も丸めた値で行う(小数のままだと毎フレーム再確保になる)
        const cw = Math.max(1, Math.round(width * dpr)), ch = Math.max(1, Math.round(height * dpr));
        if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);

        const visMode = f.visMode;
        const isLiftEnabled = visMode === VISIBILITY_MODES.LIFT || visMode === VISIBILITY_MODES.LIFT_SUD_PLUS;
        const BASE_JUDGE_Y = height - (f.isMobile ? 180 : 100);
        const JUDGE_Y = BASE_JUDGE_Y - (isLiftEnabled ? f.lift : 0);
        const mode = song?.mode || 'SP7';
        const isPmsMode = mode === 'PMS9';

        // --- レーンレイアウト (モード可変) ---
        const lanesArr = displayLanes(song, f.is2P);
        const laneX = this.laneX, laneW = this.laneW;
        const { keyW: KEY_W, boardW: BOARD_W, boardX: BOARD_X } = layoutLanes(lanesArr, width, laneX, laneW);

        // ★軽量化: ノーツ演出のグラデーション/色はレーン単位で使い回す。ジオメトリが変わったときだけ再構築。
        const gradKey = `${JUDGE_Y}|${KEY_W}|${Math.round(BOARD_X)}|${mode}|${f.is2P}`;
        const gc = this.grad;
        if (gc.key !== gradKey) {
            gc.key = gradKey;
            gc.ln = new Array(MAX_LANES); gc.hit = new Array(MAX_LANES); gc.color = new Array(MAX_LANES); gc.isScr = new Array(MAX_LANES).fill(false);
            for (const lane of lanesArr) {
                const gx = BOARD_X + laneX[lane.index];
                const ln = ctx.createLinearGradient(gx, JUDGE_Y, gx, JUDGE_Y - 300);
                ln.addColorStop(0, 'rgba(100, 200, 255, 0.3)'); ln.addColorStop(1, 'rgba(0,0,0,0)');
                gc.ln[lane.index] = ln;
                const col = laneNoteColor(lane, isPmsMode ? PMS_LANE_COLORS : null);
                gc.color[lane.index] = col;
                gc.isScr[lane.index] = lane.kind === 'scratch';
                const hit = ctx.createLinearGradient(gx, JUDGE_Y, gx, JUDGE_Y - 200);
                hit.addColorStop(0, col); hit.addColorStop(1, 'rgba(0,0,0,0)');
                gc.hit[lane.index] = hit;
            }
        }

        this._drawBoard(f, lanesArr, BOARD_X, BOARD_W, KEY_W, JUDGE_Y, isLiftEnabled, mode, isPmsMode);

        const activeLanes = this.activeLanes; activeLanes.fill(false);
        if (song) {
            this._drawNotes(f, gc, BOARD_X, BOARD_W, BASE_JUDGE_Y, JUDGE_Y);
            if (f.judge) this._drawJudge(f.judge, BOARD_X + BOARD_W / 2, JUDGE_Y - 140);
        }
        this._drawVisibilityCovers(f, BOARD_X, BOARD_W, JUDGE_Y);
        if (f.ready) {
            const rc = this.prepareReadyText();
            const img = f.ready === 'GO' ? rc.GO : rc.READY;
            ctx.drawImage(img, (width - img.width) / 2, (height - img.height) / 2);
        }
        if (f.liveResult) this._drawLiveResult(f.liveResult, width, height);
        return activeLanes;
    }

    // ★軽量化(Part1): 静的な板はオフスクリーンに1回だけ描き、毎フレームは drawImage。
    _drawBoard(f, lanesArr, BOARD_X, BOARD_W, KEY_W, JUDGE_Y, isLiftEnabled, mode, isPmsMode) {
        const { width, height, dpr } = f;
        const bOpacity = f.boardOpacity, lOpacity = f.laneOpacity;
        const laneX = this.laneX, laneW = this.laneW;
        const laneHeight = isLiftEnabled ? JUDGE_Y : height;
        const boardKey = `${width}|${height}|${dpr}|${KEY_W}|${Math.round(BOARD_X)}|${Math.round(BOARD_W)}|${JUDGE_Y}|${isLiftEnabled}|${mode}|${f.is2P}|${bOpacity}|${lOpacity}|${f.isMobile}|${!!f.song}`;
        const bl = this.board;
        if (bl.key !== boardKey) {
            bl.key = boardKey;
            const oc = bl.canvas || (bl.canvas = document.createElement('canvas'));
            oc.width = Math.max(1, Math.round(width * dpr));
            oc.height = Math.max(1, Math.round(height * dpr));
            const bx = oc.getContext('2d');
            bx.setTransform(dpr, 0, 0, dpr, 0, 0);
            bx.clearRect(0, 0, width, height);
            bx.fillStyle = `rgba(2, 6, 23, ${bOpacity})`;
            bx.fillRect(BOARD_X, 0, BOARD_W, height);
            for (const lane of lanesArr) {
                bx.fillStyle = laneBgColor(lane, lOpacity, f.isMobile, isPmsMode);
                bx.fillRect(BOARD_X + laneX[lane.index], 0, laneW[lane.index], laneHeight);
            }
            bx.strokeStyle = f.isMobile ? `rgba(51, 65, 85, ${lOpacity})` : '#334155';
            bx.lineWidth = 1; bx.beginPath();
            for (const lane of lanesArr) {
                const lx = BOARD_X + laneX[lane.index];
                bx.moveTo(lx, 0); bx.lineTo(lx, laneHeight);
                bx.moveTo(lx + laneW[lane.index], 0); bx.lineTo(lx + laneW[lane.index], laneHeight);
            }
            bx.stroke();
            if (f.song) {
                bx.strokeStyle = '#ef4444';
                bx.lineWidth = 2; bx.beginPath(); bx.moveTo(BOARD_X, JUDGE_Y); bx.lineTo(BOARD_X + BOARD_W, JUDGE_Y); bx.stroke();
            }
        }
        this.ctx.drawImage(bl.canvas, 0, 0, width, height);
    }

    // 小節線とノーツ(LN・通過直後の光)
    _drawNotes(f, gc, BOARD_X, BOARD_W, BASE_JUDGE_Y, JUDGE_Y) {
        const ctx = this.ctx;
        const { song, objects, currentTime, height, simpleFx, laneMute } = f;
        const laneX = this.laneX, laneW = this.laneW, activeLanes = this.activeLanes;
        const currentBeat = getBeatFromTime(song.timePoints, currentTime);
        const visibleDuration = 4.0 / f.hiSpeed; const visibleEndBeat = currentBeat + visibleDuration;

        ctx.strokeStyle = '#64748b'; ctx.textAlign = 'left';
        ctx.font = '10px Arial';
        // ★軽量化: 可視範囲の先頭の小節線を二分探索する
        const bars = song.barLines;
        const beatFloor = currentBeat - 0.5;
        let blo = 0, bhi = bars.length - 1, bStart = bars.length;
        while (blo <= bhi) { const mid = (blo + bhi) >> 1; if (bars[mid].beat < beatFloor) blo = mid + 1; else { bStart = mid; bhi = mid - 1; } }
        for (let bi = bStart; bi < bars.length; bi++) {
            const bar = bars[bi];
            if (bar.beat > visibleEndBeat) break;
            const y = JUDGE_Y - ((bar.beat - currentBeat) / visibleDuration * BASE_JUDGE_Y);
            if (y < -10) continue;
            ctx.beginPath(); ctx.moveTo(BOARD_X, y); ctx.lineTo(BOARD_X + BOARD_W, y);
            ctx.stroke();
            ctx.fillStyle = '#94a3b8'; ctx.fillText(`#${bar.measure}`, BOARD_X + BOARD_W + 5, y + 3);
        }

        const startIndex = findStartIndex(objects, currentTime - (song.maxLNDuration || 10.0));
        for (let i = startIndex; i < objects.length; i++) {
            const obj = objects[i];
            if (obj.beat > visibleEndBeat) break; if (!obj.isNote) continue;
            // 描画はレーン幅が確定しているものだけ
            const w = laneW[obj.laneIndex];
            if (!w) continue;
            const mAlpha = laneMute[obj.laneIndex] ? 0.28 : 1; // ★P5-2 ミュートレーンは薄く
            const beatDelta = obj.beat - currentBeat;
            const timeDelta = obj.time - currentTime;
            const x = BOARD_X + laneX[obj.laneIndex];
            const yBase = JUDGE_Y - (beatDelta / visibleDuration * BASE_JUDGE_Y);
            if (obj.type === 'long') {
                const endBeatDelta = obj.endBeat - currentBeat;
                const yEnd = JUDGE_Y - (endBeatDelta / visibleDuration * BASE_JUDGE_Y);
                if (beatDelta <= 0 && endBeatDelta > 0) {
                    activeLanes[obj.laneIndex] = true;
                    if (!simpleFx) { // lite: LN 押下中の光るグラデーションを省略
                        if (mAlpha !== 1) ctx.globalAlpha = mAlpha;
                        ctx.fillStyle = gc.ln[obj.laneIndex];   // ★キャッシュ済みグラデーション
                        ctx.fillRect(x, JUDGE_Y - 300, w, 300);
                        if (mAlpha !== 1) ctx.globalAlpha = 1;
                    }
                }
                const drawBottom = Math.min(JUDGE_Y, yBase);
                const drawTop = yEnd;
                if (drawTop <= height) {
                    const h = drawBottom - drawTop;
                    if (h > 0 && drawBottom > -50) {
                        if (mAlpha !== 1) ctx.globalAlpha = mAlpha;
                        ctx.fillStyle = gc.isScr[obj.laneIndex] ? '#ef4444' : '#f59e0b';
                        ctx.fillRect(x + 1, drawTop, w - 2, h);
                        if (mAlpha !== 1) ctx.globalAlpha = 1;
                    }
                }
            } else {
                if (obj.processed) {
                    if (timeDelta > -0.05) { // 通過直後 50ms だけ判定ラインを光らせる
                        activeLanes[obj.laneIndex] = true;
                        const alpha = (1.0 - (timeDelta / -0.05)) * mAlpha;
                        ctx.globalAlpha = alpha;
                        ctx.fillStyle = '#ffffff'; ctx.fillRect(x, JUDGE_Y - 5, w, 10);
                        if (!simpleFx) { // lite: 判定ラインから伸びる光のグラデーションを省略(白い線だけ残す)
                            ctx.globalAlpha = alpha * 0.6;
                            ctx.fillStyle = gc.hit[obj.laneIndex];
                            ctx.fillRect(x, JUDGE_Y - 200, w, 200);
                        }
                        ctx.globalAlpha = 1;
                    }
                    continue;
                }
                if (mAlpha !== 1) ctx.globalAlpha = mAlpha;
                ctx.fillStyle = gc.color[obj.laneIndex] || '#f1f5f9';
                ctx.fillRect(x + 1, yBase - 6, w - 2, 12);
                if (mAlpha !== 1) ctx.globalAlpha = 1;
            }
        }
    }

    // 6-2 プレイモード: 判定文字 + FAST/SLOW(500ms 表示、最後の 150ms でフェード)
    _drawJudge(judge, cxp, cyp) {
        const ctx = this.ctx;
        const [label, color] = JUDGE_TEXT[judge.kind] || ['', '#fff'];
        ctx.globalAlpha = judge.age < 350 ? 1 : 1 - (judge.age - 350) / 150;
        ctx.textAlign = 'center';
        ctx.font = 'bold 22px Arial';
        ctx.fillStyle = color;
        ctx.fillText(label, cxp, cyp);
        if ((judge.kind === 'gr' || judge.kind === 'gd' || judge.kind === 'bd') && judge.deltaMs !== 0) {
            const fast = judge.deltaMs < 0;
            ctx.font = 'bold 13px Arial';
            ctx.fillStyle = fast ? '#60a5fa' : '#f87171';
            ctx.fillText(`${fast ? 'FAST' : 'SLOW'} ${Math.abs(judge.deltaMs)}ms`, cxp, cyp + 18);
        }
        ctx.globalAlpha = 1;
    }

    // SUDDEN+ / HIDDEN+
    _drawVisibilityCovers(f, BOARD_X, BOARD_W, JUDGE_Y) {
        const ctx = this.ctx;
        const visMode = f.visMode;
        const isSudden = visMode === VISIBILITY_MODES.SUDDEN_PLUS || visMode === VISIBILITY_MODES.SUD_HID_PLUS || visMode === VISIBILITY_MODES.LIFT_SUD_PLUS;
        const isHidden = visMode === VISIBILITY_MODES.HIDDEN_PLUS || visMode === VISIBILITY_MODES.SUD_HID_PLUS;
        if (isSudden) {
            const h = f.suddenPlus;
            ctx.fillStyle = '#000000';
            ctx.fillRect(BOARD_X, 0, BOARD_W, h);
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(BOARD_X, h - 2, BOARD_W, 2);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center';
            ctx.fillText(`SUDDEN+ (${h})`, BOARD_X + BOARD_W / 2, h - 10);
        }
        if (isHidden) {
            const h = f.hiddenPlus;
            const yPos = JUDGE_Y - h;
            ctx.fillStyle = '#000000';
            ctx.fillRect(BOARD_X, yPos, BOARD_W, h);
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(BOARD_X, yPos, BOARD_W, 2);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center';
            ctx.fillText(`HIDDEN+ (${h})`, BOARD_X + BOARD_W / 2, yPos + 15);
        }
    }

    // 6-2-b: Tab 押下中の成績オーバーレイ
    _drawLiveResult(d, width, height) {
        const ctx = this.ctx;
        const pw = Math.min(280, width - 20), ph = 200;
        const px = (width - pw) / 2, py = Math.max(20, (height - ph) / 2 - 40);
        ctx.fillStyle = 'rgba(3, 7, 18, 0.92)'; ctx.strokeStyle = '#1e3a8a';
        ctx.lineWidth = 1; ctx.fillRect(px, py, pw, ph); ctx.strokeRect(px, py, pw, ph);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#60a5fa'; ctx.font = 'bold 10px Arial';
        ctx.fillText('RESULT (hold Tab)', px + 12, py + 18);
        ctx.fillStyle = '#e2e8f0'; ctx.font = 'bold 30px Arial'; ctx.textAlign = 'center';
        ctx.fillText(d.djLevel, px + pw / 2, py + 52);
        ctx.font = 'bold 13px Arial';
        ctx.fillText(`EX ${d.exScore} / ${d.maxEx}  (${(d.rate * 100).toFixed(2)}%)`, px + pw / 2, py + 72);
        ctx.textAlign = 'left'; ctx.font = '11px monospace';
        const rows = [
            ['PGREAT', d.pg, '#22d3ee'], ['GREAT', d.gr, '#fde047'], ['GOOD', d.gd, '#4ade80'],
            ['BAD', d.bd, '#fb923c'], ['POOR', d.poor, '#f87171'], ['空POOR', d.epoor, '#94a3b8'],
        ];
        rows.forEach(([lbl, v, col], i) => {
            const ry = py + 92 + i * 15;
            ctx.fillStyle = col; ctx.fillText(lbl, px + 16, ry);
            ctx.fillStyle = '#e2e8f0'; ctx.textAlign = 'right';
            ctx.fillText(String(v), px + pw - 16, ry); ctx.textAlign = 'left';
        });
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`MAX COMBO ${d.maxCombo}`, px + 16, py + ph - 22);
        if (d.offset) { ctx.textAlign = 'right'; ctx.fillText(`offset ${d.offset > 0 ? '+' : ''}${d.offset}ms`, px + pw - 16, py + ph - 22); ctx.textAlign = 'left'; }
        ctx.fillStyle = '#60a5fa'; ctx.fillText(`FAST ${d.fast}`, px + 16, py + ph - 8);
        ctx.fillStyle = '#f87171'; ctx.textAlign = 'right'; ctx.fillText(`SLOW ${d.slow}`, px + pw - 16, py + ph - 8);
        ctx.textAlign = 'left';
    }
}
