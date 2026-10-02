// src/bms/game/PlayJudge.js
// プレイモード(自分の入力で判定)の判定エンジン。React / 描画 / 音声には依存しない。
//   判定数・コンボ・EX SCORE・FAST/SLOW・保持中の LN・オフセット推奨用の直近ずれ を持つ。
//   判定幅は logic/judge.js の buildJudgeConfig で作った設定(setConfig)を使う。
//
// ===== LN 判定(beatoraja の既定「LN モード」準拠) =====
//   ・LN 1本 = 1ノーツ。判定は1回だけ。
//   ・始点を押した時点では判定を出さず、始点の判定を覚えておく(activeLn)。
//   ・終点まで押し続けたら、終点の時刻に「始点の判定」を確定(tickNote)。
//   ・途中で離したら「始点」と「離した時刻 vs 終点(LN終端の判定幅)」の悪い方。BAD 以下なら BAD(release)。
//   ・皿 LN も同じ(押し続けて離す)。始点を取ったキー(方向)を離したときだけ離したとみなす。
//   ・始点を逃したら POOR 1回(見逃し)。始点が BAD なら BAD 1回で LN は終了(保持しない)。
import { findStartIndex } from '../logic/utils';
import { buildJudgeConfig, classifyJudge, resolveLnRelease } from '../logic/judge';
import { djLevel } from '../constants';

const MAX_LANES = 16;
const emptyCounts = () => ({ pg: 0, gr: 0, gd: 0, bd: 0, poor: 0, epoor: 0, combo: 0, maxCombo: 0, exScore: 0, fast: 0, slow: 0 });

export class PlayJudge {
    /** @param {{ onJudge?: (kind: string, judge: PlayJudge) => void }} options onJudge: 判定が1つ確定するたびに呼ばれる */
    constructor({ onJudge } = {}) {
        this.onJudge = onJudge || (() => {});
        this.cfg = buildJudgeConfig('BMS', 'SP7', null);
        this.offsetMs = 0;                 // 判定オフセット(ms)。入力時刻からこの分を引いて判定する
        this.recentDeltas = [];            // 6-2-c: 直近の生Δms(オフセット非適用)。曲ロード時のみクリア
        this.reset();
    }

    setConfig(cfg) { this.cfg = cfg; }
    setOffset(ms) { this.offsetMs = ms; }

    /** 判定状態をリセット(recentDeltas は残す: 直近走行のタイミングをオフセット推奨に使うため) */
    reset() {
        this.counts = emptyCounts();
        this.combo = 0;
        this.notesDone = 0;                // 判定済みノーツ数(空POOR は数えない)
        this.last = { kind: '', deltaMs: 0, t: 0 }; // 直近判定(判定文字の表示・フェード用)
        this.activeLn = new Array(MAX_LANES).fill(null); // レーン別の保持中 LN { ln, startKind, startDelta, dir }
    }
    clearRecent() { this.recentDeltas = []; }

    /** 判定を1つ記録する。kind: 'pg'|'gr'|'gd'|'bd'|'poor'|'epoor'、deltaMs: 負=FAST */
    push(kind, deltaMs) {
        const j = this.counts;
        j[kind] = (j[kind] || 0) + 1;
        if (kind !== 'epoor') this.notesDone++; // 空POOR はノーツを消費しない
        if (kind === 'pg' || kind === 'gr' || kind === 'gd') {
            this.combo++;
            if (this.combo > j.maxCombo) j.maxCombo = this.combo;
            if (kind === 'pg') j.exScore += 2;
            else if (kind === 'gr') j.exScore += 1;
        } else if (kind === 'bd' || kind === 'poor') {
            this.combo = 0;
        } // epoor(空POOR) はコンボを切らない
        j.combo = this.combo;
        if ((kind === 'gr' || kind === 'gd' || kind === 'bd') && deltaMs !== 0) {
            if (deltaMs < 0) j.fast++; else j.slow++;
        }
        this.last = { kind, deltaMs: Math.round(deltaMs), t: performance.now() };
        this.onJudge(kind, this);
    }

    /**
     * 1回のキー/皿の押下を判定する。
     *   通常ノーツ: BAD 窓内で最寄りの未処理ノーツを判定。皿はどちらの方向でも可。
     *   判定対象が無く、空POOR 範囲にノーツが居れば空POOR(完全な空白は無反応)。
     * @param {object[]} objects 時刻順の譜面オブジェクト(processed を書き換える)
     * @param {number} songTime 入力時の曲の時刻(秒。オフセット適用前)
     * @param {string|undefined} scDir 皿の方向('A'|'B')
     * @returns {boolean} ノーツを判定したか(レーン別ノーツ数の加算用)
     */
    press(objects, lane, songTime, isScratch, scDir) {
        // LN 保持中の押し直し(皿の別方向キーなど)は何もしない(beatoraja の「押し直し」と同じく判定なし)
        if (this.activeLn[lane]) return false;
        const w = isScratch ? this.cfg.scratch : this.cfg.note;
        const ep = this.cfg.epoor;
        const t = songTime - this.offsetMs / 1000;

        // target: BAD 窓(早 bdEarly / 遅 bdLate)内で最寄りの未処理ノーツ
        // nearAny: 空POOR 範囲(ノーツより ep.early ms 早い〜ep.late ms 遅い)にノーツ(処理済み可)が居るか
        let target = null, best = Infinity, nearAny = false;
        const c = findStartIndex(objects, t - ep.late / 1000 - 0.05);
        for (let i = Math.max(0, c - 4); i < objects.length; i++) {
            const o = objects[i];
            if (o.time > t + ep.early / 1000 + 0.05) break;
            if (!o.isNote || o.laneIndex !== lane) continue;
            const dMs = (t - o.time) * 1000; // 負 = ノーツより早く押した
            if (dMs < 0 ? -dMs <= ep.early : dMs <= ep.late) nearAny = true;
            const inBad = dMs < 0 ? -dMs <= w.bdEarly : dMs <= w.bdLate;
            if (!o.processed && inBad && Math.abs(dMs) < best) { best = Math.abs(dMs); target = o; }
        }
        if (!target) {
            if (nearAny) this.push('epoor', 0);
            return false;
        }

        const deltaMs = (t - target.time) * 1000; // 負=FAST(早い) / 正=SLOW(遅い)
        const kind = classifyJudge(deltaMs, w) || 'bd';
        target.processed = true;
        // LN の始点が PG/GR/GD なら判定は保留して「保持中」に。BAD はその場で確定。
        if (target.type === 'long' && kind !== 'bd') {
            this.activeLn[lane] = { ln: target, startKind: kind, startDelta: deltaMs, dir: isScratch ? (scDir || null) : null };
        } else {
            this.push(kind, deltaMs);
        }
        // 6-2-c: オフセット推奨用に生Δ(オフセット非適用)を記録。近い判定だけ(GOOD 以内)採用。
        if (kind === 'pg' || kind === 'gr' || kind === 'gd') {
            this.recentDeltas.push(deltaMs + this.offsetMs);
            if (this.recentDeltas.length > 60) this.recentDeltas.shift();
        }
        return true;
    }

    /** キー/皿を離した。保持中の LN があれば、始点と離しタイミングの悪い方で確定する */
    release(lane, songTime, isScratch, scDir) {
        const a = this.activeLn[lane];
        if (!a) return;
        if (a.dir && scDir && scDir !== a.dir) return; // 皿: 始点を取った方向以外のキーを離しても LN は離さない
        this._finishLn(lane, songTime - this.offsetMs / 1000, isScratch);
    }

    /**
     * 1フレームぶんの通過処理(時刻を過ぎたノーツ1つずつに呼ぶ)。
     *   見逃し: BAD 窓の遅れ側を未処理で越えたら POOR / LN を終点まで押し続けたら始点の判定で確定。
     */
    tickNote(obj, currentTime, isScratch) {
        if (!obj.processed) {
            const bdSec = (isScratch ? this.cfg.scratch : this.cfg.note).bdLate / 1000;
            if (obj.time - currentTime < -bdSec) { obj.processed = true; this.push('poor', 0); }
        } else if (obj.type === 'long' && this.activeLn[obj.laneIndex]?.ln === obj) {
            if (currentTime - this.offsetMs / 1000 >= (obj.endTime ?? obj.time)) this._finishLn(obj.laneIndex, null, isScratch);
        }
    }

    // 保持中の LN を確定させる。releaseT = 離した時刻(終点まで押し続けた場合は null)
    _finishLn(lane, releaseT, isScratch) {
        const a = this.activeLn[lane];
        if (!a) return;
        this.activeLn[lane] = null;
        if (releaseT === null) { this.push(a.startKind, a.startDelta); return; }
        const earlyMs = ((a.ln.endTime ?? a.ln.time) - releaseT) * 1000; // 正 = 終点より早く離した
        const r = resolveLnRelease(a.startKind, a.startDelta, earlyMs, isScratch ? this.cfg.lnScratchEnd : this.cfg.lnEnd);
        this.push(r.kind, r.delta);
    }

    /** 6-2-c: 直近の判定タイミングから推奨オフセットを算出(中央値) */
    suggestOffset() {
        const arr = this.recentDeltas;
        if (arr.length < 10) return { n: arr.length, value: 0 };
        const sorted = [...arr].sort((a, b) => a - b);
        const m = sorted.length % 2
            ? sorted[(sorted.length - 1) / 2]
            : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
        return { n: arr.length, value: Math.round(m) };
    }

    /** 6-2-b: 成績データ(リザルト / Tab オーバーレイ / InfoPanel 共通) */
    result(song, finished) {
        const j = this.counts;
        const total = song?.totalNotes || 0;
        const maxEx = total * 2;
        const rate = maxEx ? j.exScore / maxEx : 0;
        return {
            finished,
            title: song?.header?.title || '',
            keyMode: song?.keyMode || '—',
            level: song?.header?.playlevel || '—',
            exScore: j.exScore, maxEx,
            djLevel: djLevel(rate), rate,
            pg: j.pg, gr: j.gr, gd: j.gd, bd: j.bd, poor: j.poor, epoor: j.epoor,
            maxCombo: j.maxCombo, fast: j.fast, slow: j.slow,
            judged: this.notesDone, total,
            offset: this.offsetMs,
        };
    }
}
