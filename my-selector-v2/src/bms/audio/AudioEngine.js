// src/bms/audio/AudioEngine.js
// 音声まわり(Web Audio)を1か所にまとめたクラス。React には依存しない。
//   - AudioContext / マスター音量 / エフェクトラック(FILTER → EQ → COMP → 出力、COMP → ECHO)
//   - デコード済み音源のキャッシュ
//   - 譜面の発音予約(先読みスケジューラ)、同時発音数の上限、統計(POLY / DROP)
//   - 描画・判定用の滑らかな時計
// 「どの音を鳴らすか」「モニター表示」は呼び出し側が schedule() のコールバックで決める。
import { LOOKAHEAD, SCHEDULE_INTERVAL, MAX_SHORT_POLYPHONY } from '../constants';
import { createHitSound } from '../logic/utils';

export class AudioEngine {
    constructor() {
        this.ctx = null;
        this.master = null;          // マスターゲイン(音量)
        this.fx = null;              // { filter, eqLow, eqMid, eqHigh, comp, delay, feedback, echoWet }
        this.fxBypass = false;
        this.buffers = new Map();    // 小文字ファイル名 → AudioBuffer(フォルダ内で使い回す)
        this.nodes = [];             // 発音中/予約済みのノード { node, startTime, endTime, isLong, id }
        this.startTime = 0;          // 曲の 0 秒に対応する AudioContext 時刻
        this.nextIndex = 0;          // スケジューラの次に見るオブジェクト
        this.midStartPending = false; // 次の schedule() 1回だけ、開始地点より前に鳴り始めた音を途中から鳴らす
        this.maxSoundDuration = 0;   // 読み込んだ音源のうち最長の長さ(秒)。途中再生の探索範囲に使う
        this.stats = { poly: 0, maxPoly: 0, history: [], dropped: 0 };
        this.nextId = 1;             // ノード/モニター項目の一意 ID
        this.timer = null;
        this.clock = { off: null, lastNow: 0 };
    }

    /** AudioContext とエフェクトラックを作る(マウント時に1回) */
    init(volume, fxBypass) {
        const AC = window.AudioContext || window.webkitAudioContext;
        const ac = this.ctx = new AC({ latencyHint: 'interactive' });
        this.master = ac.createGain();
        this.master.gain.value = volume;

        // 6-3: エフェクトラック。マスターゲイン → FILTER → EQ(3band) → COMP → destination(dry)
        //      COMP → DELAY → echoWet → destination、DELAY → feedback → DELAY (ECHO)
        //      各エフェクトは常時接続し、無効時は「素通しになる値」にする(再接続によるプチノイズ回避)。
        const filter = ac.createBiquadFilter();  filter.type = 'lowpass'; filter.frequency.value = 22000;
        const eqLow = ac.createBiquadFilter();   eqLow.type = 'lowshelf';  eqLow.frequency.value = 250;  eqLow.gain.value = 0;
        const eqMid = ac.createBiquadFilter();   eqMid.type = 'peaking';   eqMid.frequency.value = 1000; eqMid.Q.value = 0.9; eqMid.gain.value = 0;
        const eqHigh = ac.createBiquadFilter();  eqHigh.type = 'highshelf'; eqHigh.frequency.value = 4000; eqHigh.gain.value = 0;
        const comp = ac.createDynamicsCompressor();
        comp.threshold.value = 0; comp.ratio.value = 1; comp.knee.value = 30; comp.attack.value = 0.003; comp.release.value = 0.25;
        const delay = ac.createDelay(2.0); delay.delayTime.value = 0.3;
        const feedback = ac.createGain(); feedback.gain.value = 0;
        const echoWet = ac.createGain(); echoWet.gain.value = 0;
        filter.connect(eqLow); eqLow.connect(eqMid); eqMid.connect(eqHigh); eqHigh.connect(comp);
        comp.connect(ac.destination);                                          // dry
        comp.connect(delay); delay.connect(feedback); feedback.connect(delay); // feedback ループ
        delay.connect(echoWet); echoWet.connect(ac.destination);               // wet
        this.fx = { filter, eqLow, eqMid, eqHigh, comp, delay, feedback, echoWet };
        this.fxBypass = !fxBypass; // setFxBypass で必ず接続させる
        this.setFxBypass(fxBypass);
    }

    close() {
        this.stopScheduler();
        if (this.ctx) this.ctx.close();
    }

    resumeIfSuspended() { if (this.ctx?.state === 'suspended') this.ctx.resume(); }

    setVolume(v) { if (this.master) this.master.gain.value = v; }

    /** 6-3: サウンドエフェクトのパラメータを反映。無効時は素通しになる値に。 */
    applyFx(audioFx) {
        const n = this.fx, ac = this.ctx;
        if (!n || !ac) return;
        const now = ac.currentTime;
        const set = (param, v) => { try { param.setTargetAtTime(v, now, 0.02); } catch { param.value = v; } };
        const master = !!audioFx.enabled;
        // FILTER
        const fOn = master && audioFx.filter.on;
        n.filter.type = audioFx.filter.type === 'highpass' ? 'highpass' : 'lowpass';
        set(n.filter.frequency, fOn ? Math.max(20, Math.min(22000, audioFx.filter.freq)) : (n.filter.type === 'highpass' ? 20 : 22000));
        // EQ (3band)
        const eOn = master && audioFx.eq.on;
        set(n.eqLow.gain, eOn ? audioFx.eq.low : 0);
        set(n.eqMid.gain, eOn ? audioFx.eq.mid : 0);
        set(n.eqHigh.gain, eOn ? audioFx.eq.high : 0);
        // COMP
        const cOn = master && audioFx.comp.on;
        set(n.comp.threshold, cOn ? audioFx.comp.threshold : 0);
        set(n.comp.ratio, cOn ? Math.max(1, audioFx.comp.ratio) : 1);
        // ECHO
        const ecOn = master && audioFx.echo.on;
        set(n.delay.delayTime, Math.max(0.01, Math.min(2.0, audioFx.echo.time)));
        set(n.feedback.gain, ecOn ? Math.max(0, Math.min(0.9, audioFx.echo.feedback)) : 0);
        set(n.echoWet.gain, ecOn ? Math.max(0, Math.min(1, audioFx.echo.mix)) : 0);
    }

    /** lite: エフェクト無効時はエフェクトラックを経路から外し、マスター → 出力 直結にする */
    setFxBypass(bypass) {
        if (!this.ctx || bypass === this.fxBypass) return;
        this.fxBypass = bypass;
        try { this.master.disconnect(); } catch { /* 未接続 */ }
        this.master.connect(bypass ? this.ctx.destination : this.fx.filter);
    }

    decode(arrayBuffer) { return this.ctx.decodeAudioData(arrayBuffer); }
    createHitSound() { return createHitSound(this.ctx); }

    // ===== 時計 =====
    // ★カクつき対策: AudioContext.currentTime は音声処理ブロック単位(Windows では 10〜20ms 程度)でしか進まず、
    //   60fps の描画と周期が合わないため、そのまま使うとフレームごとのスクロール量がばらついてカクついて見える。
    //   performance.now() で補間する。currentTime は「ブロック開始時刻」で実時刻より 0〜1ブロック遅れるので、
    //   (currentTime - perf) の最大値を実際のオフセットとみなし、時計のドリフトにはゆっくり減衰させて追従する。
    resetClock() { this.clock = { off: null, lastNow: 0 }; }
    now() {
        const ac = this.ctx;
        if (!ac) return 0;
        const c = ac.currentTime;
        const s = this.clock;
        if (ac.state !== 'running') { s.off = null; return c; } // 停止中の音声時計は進まないので補間しない
        const now = performance.now() / 1000;
        const sample = c - now;
        if (s.off === null || Math.abs(sample - s.off) > 0.1) s.off = sample;   // 初回・一時停止明け・大きな乱れは即同期
        else if (sample > s.off) s.off = sample;
        else s.off -= Math.min(0.1, Math.max(0, now - s.lastNow)) * 0.002;   // 2ms/秒で減衰(音声時計とのドリフト追従)
        s.lastNow = now;
        return now + s.off;
    }
    /** 曲の現在時刻(秒) */
    songTime() { return this.now() - this.startTime; }

    // ===== 再生制御 =====
    /** 曲の offset 秒を「今」に合わせる */
    alignSongTime(offset) { if (this.ctx) this.startTime = this.ctx.currentTime - offset; }

    startScheduler(tick) {
        this.stopScheduler();
        this.timer = setInterval(tick, SCHEDULE_INTERVAL);
    }
    stopScheduler() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }

    /** 発音中・予約済みの音をすべて止め、スケジューラも止める */
    stopAll() {
        this.nodes.forEach(n => { try { n.node.stop(); n.node.disconnect(); } catch (e) {} });
        this.nodes = [];
        this.stopScheduler();
    }

    resetStats() { this.stats = { poly: 0, maxPoly: 0, history: [], dropped: 0 }; }

    /** 平均同時発音数(直近の履歴から) */
    averagePoly() {
        const h = this.stats.history;
        return h.length ? Math.round(h.reduce((a, b) => a + b, 0) / h.length) : 0;
    }

    /**
     * 音源をすぐ鳴らす(プレイヤー入力のキー音)。同時発音数の上限の対象にするため nodes に載せる。
     * ★音量はマスターで掛かるので、ここでは掛けない(個別に掛けると volume² になる)。
     */
    playNow(buffer) {
        const ac = this.ctx;
        const src = ac.createBufferSource();
        src.buffer = buffer;
        src.connect(this.master);
        const t = ac.currentTime;
        const nodeData = { node: src, startTime: t, endTime: t + buffer.duration, isLong: false, id: this.nextId++ };
        this.nodes.push(nodeData);
        src.onended = () => { // ★リーク対策: 終了したノードは必ず切断する
            try { src.disconnect(); } catch (e) {}
            const k = this.nodes.indexOf(nodeData);
            if (k !== -1) this.nodes.splice(k, 1);
        };
        src.start(0);
    }

    /**
     * 先読みスケジューラ(SCHEDULE_INTERVAL ごとに呼ぶ)。LOOKAHEAD 秒先までのオブジェクトの発音を予約する。
     * @param {object[]} objects 時刻順の譜面オブジェクト
     * @param {(obj) => AudioBuffer|null|undefined} getBuffer オブジェクトの音源(WAV 定義が無ければ undefined、未読込なら null)
     * @param {object} policy
     *   classify(obj, buffer) => { play: boolean, isBgm: boolean }  鳴らすか / BGM(長い音源)か
     *   onItem(item, { play, isBgm })   モニター表示用の項目(鳴らさない音も渡す)。item = { id, name, startTime, endTime, displayDuration, isLong, isMuted, ... }
     *   hitSound(obj) => { buffer, gain } | null   ノーツの打鍵音(鳴らさないなら null)
     */
    schedule(objects, getBuffer, policy) {
        const ctx = this.ctx;
        const currentTime = ctx.currentTime;
        const scheduleUntil = currentTime + LOOKAHEAD;
        let index = this.nextIndex;

        // 終わったノードを片付け、短い音が多すぎたら古いものから止める
        this.nodes = this.nodes.filter(n => n.endTime > currentTime);
        const shortNodes = this.nodes.filter(n => !n.isLong);
        if (shortNodes.length > MAX_SHORT_POLYPHONY) {
            const toKill = shortNodes.sort((a, b) => a.startTime - b.startTime).slice(0, shortNodes.length - MAX_SHORT_POLYPHONY);
            toKill.forEach(n => { try { n.node.stop(); } catch (e) {} });
            const killedIds = new Set(toKill.map(n => n.id));
            this.nodes = this.nodes.filter(n => !killedIds.has(n.id));
        }
        // ★軽量化: 統計は記録するだけ。表示は描画ループ側で間引く。履歴は一定数でキャップ。
        const st = this.stats;
        st.poly = this.nodes.length;
        if (st.poly > st.maxPoly) st.maxPoly = st.poly;
        st.history.push(st.poly);
        if (st.history.length > 400) st.history.shift();

        // 途中からの開始直後の1回だけ、開始地点より前に鳴り始めた音を途中から鳴らす
        const midStart = this.midStartPending;
        this.midStartPending = false;
        // 途中再生の開始時刻。「今」を読んでから start() するまでに時計が進むとその分 BGM が遅れるため、
        // 少し先の時刻を開始時刻にして、その時刻に対応する位置から再生する(サンプル精度で一致させる)。
        const midStartAt = currentTime + 0.05;

        while (index < objects.length) {
            const obj = objects[index];
            const absolutePlayTime = this.startTime + obj.time;
            if (absolutePlayTime > scheduleUntil) break;
            const isMidStart = absolutePlayTime < currentTime - 0.1;
            const buffer = getBuffer(obj);
            if (isMidStart && !midStart) {
                // 予約が間に合わず捨てた音を数える(0 以外なら処理落ちで音抜けしている)
                if (buffer !== undefined) st.dropped++;
                index++; continue;
            }
            // 途中再生の対象でも、開始時刻までに鳴り終わっている音は何もしない(モニターにも載せない)
            if (buffer && (!isMidStart || absolutePlayTime + buffer.duration > midStartAt + 0.01)) {
                const { play, isBgm } = policy.classify(obj, buffer);
                const id = this.nextId++;
                if (play) this._playScheduled(buffer, absolutePlayTime, currentTime, isMidStart ? midStartAt : null, id);
                policy.onItem({
                    id, name: obj.filename, startTime: obj.time, endTime: obj.time + buffer.duration,
                    displayDuration: buffer.duration, isLong: isBgm, isMissing: false, isSkipped: false, isMuted: !play,
                }, { play, isBgm });
            }
            // 途中再生の対象(開始地点より前のノーツ)では打鍵音を鳴らさない
            if (obj.isNote && !isMidStart) {
                const hit = policy.hitSound(obj);
                if (hit && hit.buffer) this._playHit(hit.buffer, hit.gain, Math.max(currentTime, absolutePlayTime));
            }
            index++;
        }
        this.nextIndex = index;
    }

    _playScheduled(buffer, absolutePlayTime, currentTime, midStartAt, id) {
        const ctx = this.ctx;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        let fade = null;
        if (midStartAt !== null) {
            // 途中再生: 波形の途中から急に鳴る「プツッ」を防ぐため 5ms でフェードイン
            fade = ctx.createGain();
            fade.gain.setValueAtTime(0, midStartAt);
            fade.gain.linearRampToValueAtTime(1, midStartAt + 0.005);
            src.connect(fade); fade.connect(this.master);
            src.start(midStartAt, midStartAt - absolutePlayTime);
        } else {
            src.connect(this.master);
            if (absolutePlayTime >= currentTime) src.start(absolutePlayTime);
            else { const offset = currentTime - absolutePlayTime; if (offset < buffer.duration) src.start(currentTime, offset); }
        }
        // 10 秒を超える音はポリフォニー上限の対象外
        const nodeData = { node: src, startTime: absolutePlayTime, endTime: absolutePlayTime + buffer.duration, isLong: buffer.duration > 10.0, id };
        this.nodes.push(nodeData);
        src.onended = () => { // ★リーク対策: 自然終了したノードは切断し、nodes からも除去する
            try { src.disconnect(); if (fade) fade.disconnect(); } catch (e) {}
            const k = this.nodes.indexOf(nodeData);
            if (k !== -1) this.nodes.splice(k, 1);
        };
    }

    _playHit(buffer, gainValue, when) {
        const ctx = this.ctx;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.value = gainValue;
        src.connect(gain);
        gain.connect(this.master);
        // ★リーク対策: 打鍵音の src / gain を終了時に切断(GainNode は自動解放されない)
        src.onended = () => { try { src.disconnect(); gain.disconnect(); } catch (e) {} };
        src.start(when);
    }
}
