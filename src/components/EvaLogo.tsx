import { useEffect, useRef } from 'react';

/* ────────────────────────────  EVA MORPHING MARK  ──────────────────────────────
   Eva's visual identity: five orange circles fused into one organic shape via
   the goo-filter (Gaussian blur + alpha threshold). The canonical state is a
   regular pentagon; idle behaviour slow-spins the pentagon and intermittently
   collapses the wrappers toward (50,50) before blooming into an asymmetric
   "thinking" constellation and returning home.
   Ported from eva-work/eva-journal-prototype/components/eva/EvaLogo.jsx. */

type Circle = [number, number, number];
type Constellation = Circle[];

const EVA_POOL: Constellation[] = [
    [[50, 14, 11], [84, 39, 11], [71, 79, 11], [29, 79, 11], [16, 39, 11]], // 0 canonical pentagon
    [[30, 30, 16], [45, 48, 11], [60, 66, 8], [75, 22, 10], [14, 80, 8]],
    [[58, 32, 16], [42, 22, 10], [28, 58, 9], [78, 55, 8], [55, 82, 11]],
    [[35, 22, 16], [55, 28, 11], [52, 68, 9], [18, 55, 8], [80, 75, 11]],
    [[62, 22, 16], [58, 44, 11], [50, 66, 8], [82, 82, 8], [18, 76, 8]],
    [[45, 22, 16], [52, 42, 11], [60, 60, 9], [22, 72, 11], [78, 30, 9]],
    [[65, 22, 16], [50, 36, 10], [40, 54, 8], [50, 72, 6], [80, 80, 6]],
    [[30, 70, 16], [50, 80, 12], [65, 65, 10], [75, 25, 8], [30, 20, 8]],
    [[60, 25, 16], [70, 45, 11], [55, 55, 9], [20, 30, 7], [25, 80, 7]],
    [[35, 25, 16], [55, 22, 10], [45, 42, 8], [75, 65, 11], [22, 75, 8]],
    [[18, 28, 9], [55, 18, 11], [60, 50, 10], [78, 60, 14], [28, 80, 7]],
    [[40, 22, 14], [25, 40, 11], [40, 58, 10], [70, 50, 8], [85, 75, 8]],
];
const EVA_CANONICAL_IDX = 0;
const EVA_EASING = 'cubic-bezier(0.4, 0.0, 0.2, 1)';
const EVA_COLLAPSE_DELTAS: [number, number][] = [
    [0, 36],
    [-34, 11],
    [-21, -29],
    [21, -29],
    [34, 11],
];

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
const randInt = (a: number, b: number) => Math.floor(a + Math.random() * (b - a + 1));
const awaitAnims = (anims: Animation[]) => Promise.all(anims.map((a) => a.finished.catch(() => {})));

/* eslint-disable @typescript-eslint/no-explicit-any */

function evaSetStatic(logoEl: SVGSVGElement, constellation: Constellation) {
    logoEl.querySelectorAll<SVGCircleElement>('.c').forEach((c, i) => {
        const [cx, cy, r] = constellation[i];
        c.style.cx = cx + 'px';
        c.style.cy = cy + 'px';
        c.style.r = r + 'px';
        (c as any).__evaLastTarget = [cx, cy, r];
    });
}

function evaAnimateTo(logoEl: SVGSVGElement, constellation: Constellation, duration: number): Animation[] {
    return Array.from(logoEl.querySelectorAll<SVGCircleElement>('.c')).map((c, i) => {
        const oldAnims = c.getAnimations();
        const hasRunning = oldAnims.some((a) => a.playState === 'running');
        if (hasRunning) {
            const cs = getComputedStyle(c);
            const ncx = parseFloat(cs.cx);
            const ncy = parseFloat(cs.cy);
            const nr = parseFloat(cs.r);
            if (!isNaN(ncx) && !isNaN(ncy) && !isNaN(nr)) {
                (c as any).__evaLastTarget = [ncx, ncy, nr];
            }
        }
        const prev = (c as any).__evaLastTarget as Circle | undefined;
        const [cx, cy, r] = constellation[i];
        const keyframes = prev
            ? [
                  { cx: prev[0] + 'px', cy: prev[1] + 'px', r: prev[2] + 'px' },
                  { cx: cx + 'px', cy: cy + 'px', r: r + 'px' },
              ]
            : [{ cx: cx + 'px', cy: cy + 'px', r: r + 'px' }];
        const anim = c.animate(keyframes as Keyframe[], { duration, easing: EVA_EASING, fill: 'forwards' });
        (c as any).__evaLastTarget = [cx, cy, r];
        oldAnims.forEach((a) => a.cancel());
        return anim;
    });
}

function evaAnimateWrappers(
    wraps: NodeListOf<Element>,
    target: string | ((i: number) => string),
    duration: number
): Animation[] {
    return Array.from(wraps).map((w, i) => {
        const el = w as HTMLElement;
        const curT = getComputedStyle(el).transform;
        el.getAnimations().forEach((a) => {
            try {
                a.commitStyles();
            } catch (_) {
                /* noop */
            }
            a.cancel();
        });
        if (curT && curT !== 'none') el.style.transform = curT;
        const t = typeof target === 'function' ? target(i) : target;
        const anim = el.animate({ transform: t }, { duration, easing: EVA_EASING, fill: 'forwards' });
        try {
            (anim as any).persist();
        } catch (_) {
            /* noop */
        }
        return anim;
    });
}

const evaCollapseControllers = new WeakMap<SVGSVGElement, { stopped: boolean }>();

async function evaStartCollapseLoop(logoEl: SVGSVGElement) {
    if (evaCollapseControllers.has(logoEl)) return;
    const controller = { stopped: false };
    evaCollapseControllers.set(logoEl, controller);

    const wraps = logoEl.querySelectorAll('.c-wrap');
    if (!wraps.length) {
        evaCollapseControllers.delete(logoEl);
        return;
    }

    const recentPicks = new Set<number>();

    while (!controller.stopped) {
        await sleep(randInt(4000, 6000));
        if (controller.stopped) break;

        const inAnims = evaAnimateWrappers(
            wraps,
            (i) => {
                const [dx, dy] = EVA_COLLAPSE_DELTAS[i];
                return `translate(${dx}px, ${dy}px)`;
            },
            1000
        );
        await awaitAnims(inAnims);
        if (controller.stopped) break;

        const available: number[] = [];
        for (let j = 1; j < EVA_POOL.length; j++) {
            if (!recentPicks.has(j)) available.push(j);
        }
        const pickIdx = available[Math.floor(Math.random() * available.length)];
        recentPicks.add(pickIdx);
        if (recentPicks.size >= EVA_POOL.length - 3) recentPicks.clear();

        const expandAnims = evaAnimateWrappers(wraps, 'translate(0, 0)', 1000);
        const morphAnims = evaAnimateTo(logoEl, EVA_POOL[pickIdx], 1000);
        await Promise.all([awaitAnims(expandAnims), awaitAnims(morphAnims)]);
        if (controller.stopped) break;

        await sleep(1200);
        if (controller.stopped) break;

        const returnAnims = evaAnimateTo(logoEl, EVA_POOL[EVA_CANONICAL_IDX], 1000);
        await awaitAnims(returnAnims);
        if (controller.stopped) break;
    }

    if (evaCollapseControllers.get(logoEl) === controller) evaCollapseControllers.delete(logoEl);
}

async function evaStopCollapseLoop(logoEl: SVGSVGElement) {
    const c = evaCollapseControllers.get(logoEl);
    if (c) c.stopped = true;
    evaCollapseControllers.delete(logoEl);

    const wraps = logoEl.querySelectorAll('.c-wrap');
    if (!wraps.length) return;

    let needsSettle = false;
    wraps.forEach((w) => {
        const t = getComputedStyle(w as HTMLElement).transform;
        if (t && t !== 'none' && t !== 'matrix(1, 0, 0, 1, 0, 0)') needsSettle = true;
    });
    if (!needsSettle) {
        wraps.forEach((w) => {
            (w as HTMLElement).getAnimations().forEach((a) => a.cancel());
            (w as HTMLElement).style.transform = '';
        });
        return;
    }

    const settles = Array.from(wraps).map((w) => {
        const el = w as HTMLElement;
        el.getAnimations().forEach((a) => {
            try {
                a.commitStyles();
            } catch (_) {
                /* noop */
            }
            a.cancel();
        });
        return el.animate({ transform: 'translate(0, 0)' }, { duration: 200, easing: 'ease-out', fill: 'forwards' });
    });
    await awaitAnims(settles);

    wraps.forEach((w) => {
        (w as HTMLElement).getAnimations().forEach((a) => a.cancel());
        (w as HTMLElement).style.transform = '';
    });
}

async function evaStartThinkingLoop(logoEl: SVGSVGElement) {
    if (logoEl.dataset.thinkingLoop === 'true') return;
    logoEl.dataset.thinkingLoop = 'true';
    const used = new Set<number>();
    while (logoEl.dataset.thinkingLoop === 'true') {
        const available: number[] = [];
        for (let j = 1; j < EVA_POOL.length; j++) {
            if (!used.has(j)) available.push(j);
        }
        const pickIdx = available[Math.floor(Math.random() * available.length)];
        used.add(pickIdx);
        if (used.size >= EVA_POOL.length - 3) used.clear();
        const duration = randInt(450, 750);
        const anims = evaAnimateTo(logoEl, EVA_POOL[pickIdx], duration);
        await awaitAnims(anims);
    }
}

function evaStopThinkingLoop(logoEl: SVGSVGElement) {
    logoEl.dataset.thinkingLoop = 'false';
}

/* Mount once at app level — provides the shared <filter id="eva-goo-filter">
   referenced by every .eva-logo via url(#eva-goo-filter). */
export function EvaLogoDefs() {
    return (
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
            <defs>
                <filter id="eva-goo-filter" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                    <feColorMatrix in="blur" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 29 -11" result="goo" />
                    <feBlend in="SourceGraphic" in2="goo" />
                </filter>
            </defs>
        </svg>
    );
}

type EvaLogoProps = {
    size?: number;
    mode?: 'static' | 'idle' | 'thinking';
    white?: boolean;
    className?: string;
    style?: React.CSSProperties;
};

export function EvaLogo({ size = 20, mode = 'static', white = false, className, style }: EvaLogoProps) {
    const ref = useRef<SVGSVGElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        // Always start from the canonical pentagon so the mark renders correctly
        // before the (deferred) animation loop kicks off.
        evaSetStatic(el, EVA_POOL[EVA_CANONICAL_IDX]);
        if (mode === 'idle') {
            evaStartCollapseLoop(el);
            return () => {
                evaStopCollapseLoop(el);
            };
        }
        if (mode === 'thinking') {
            evaStartThinkingLoop(el);
            return () => {
                evaStopThinkingLoop(el);
            };
        }
        return undefined;
    }, [mode]);

    const classes = [
        'eva-logo',
        'interactive',
        mode === 'idle' ? 'idle-logo' : '',
        mode === 'thinking' ? 'thinking-loop' : '',
        white ? 'white' : '',
        className ?? '',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <svg
            ref={ref}
            className={classes}
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: size, height: size, ...style }}
            aria-hidden="true"
        >
            <g className="stage-group">
                <g className="c-wrap cw1">
                    <circle className="c c1" cx="50" cy="14" r="11" />
                </g>
                <g className="c-wrap cw2">
                    <circle className="c c2" cx="84" cy="39" r="11" />
                </g>
                <g className="c-wrap cw3">
                    <circle className="c c3" cx="71" cy="79" r="11" />
                </g>
                <g className="c-wrap cw4">
                    <circle className="c c4" cx="29" cy="79" r="11" />
                </g>
                <g className="c-wrap cw5">
                    <circle className="c c5" cx="16" cy="39" r="11" />
                </g>
            </g>
        </svg>
    );
}
