import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
    Button,
    Drawer,
    Header,
    Icon,
    IconButton,
    Layout,
    Menu,
    Navigation2,
    Table3,
    Tabs,
} from '@economic/taco';
import { EvaLogo, EvaLogoDefs } from './components/EvaLogo';
import { loadSnapshot, buildContext, hasEconomicCredentials } from './evaData';

type AISuggestion = {
    value: string;
    confidence: 'high' | 'medium' | 'low';
    reason: string;
    sources: string[];
};

type SuggestableField = 'konto' | 'modkonto' | 'moms';

type Posting = {
    id: number;
    bilag: number;
    dato: string;
    tekst: string;
    konto: string;
    modkonto: string;
    debit: number;
    kredit: number;
    moms: string;
    aiSuggestions?: Partial<Record<SuggestableField, AISuggestion>>;
};

const initialPostings: Posting[] = [
    { id: 1, bilag: 1, dato: '02.01.2026', tekst: 'Husleje januar', konto: '6310 Husleje', modkonto: '5810 Bankkonto', debit: 12500, kredit: 0, moms: 'I25' },
    { id: 2, bilag: 2, dato: '03.01.2026', tekst: 'Kontorartikler – Lyreco', konto: '6500 Kontorhold', modkonto: '5810 Bankkonto', debit: 1850, kredit: 0, moms: 'I25' },
    { id: 3, bilag: 3, dato: '05.01.2026', tekst: 'Forsikring Q1', konto: '6450 Forsikring', modkonto: '5810 Bankkonto', debit: 8400, kredit: 0, moms: '' },
    { id: 4, bilag: 4, dato: '08.01.2026', tekst: 'Flyrejse København–Berlin', konto: '6210 Rejseudgifter', modkonto: '5810 Bankkonto', debit: 3450, kredit: 0, moms: 'I25' },
    { id: 5, bilag: 5, dato: '10.01.2026', tekst: 'Hotel Berlin (3 nætter)', konto: '6210 Rejseudgifter', modkonto: '5810 Bankkonto', debit: 4200, kredit: 0, moms: 'I25' },
    {
        id: 6, bilag: 6, dato: '12.01.2026', tekst: 'Frokostmøde med kunde',
        konto: '6230 Repræsentation', modkonto: '5810 Bankkonto', debit: 850, kredit: 0, moms: 'I25',
        aiSuggestions: {
            moms: {
                value: 'I25',
                confidence: 'medium',
                reason: 'Repræsentation kan have reduceret moms-fradrag — Eva har valgt I25 men anbefaler at verificere mod kvitteringen, særligt hvis det er bevirtning under skattereglen.',
                sources: ['Konto 6230 standard: I25', 'Note: Bevirtning kan have begrænset fradrag — tjek SKAT-vejledning'],
            },
        },
    },
    {
        id: 7, bilag: 7, dato: '14.01.2026', tekst: 'Adobe Creative Cloud',
        konto: '6520 Software', modkonto: '5810 Bankkonto', debit: 549, kredit: 0, moms: 'I25',
        aiSuggestions: {
            konto: {
                value: '6520 Software',
                confidence: 'high',
                reason: 'Adobe-abonnementer er konsekvent bogført på 6520 Software i de sidste 12 måneder. Beløbet og leverandøren matcher mønsteret.',
                sources: ['Bilag 14 — Webhosting på 6520', 'Adobe-posteringer i december og november (alle på 6520)'],
            },
        },
    },
    {
        id: 8, bilag: 8, dato: '16.01.2026', tekst: 'Bankgebyrer januar',
        konto: '7120 Bankgebyrer', modkonto: '5810 Bankkonto', debit: 245, kredit: 0, moms: '',
        aiSuggestions: {
            konto: {
                value: '7120 Bankgebyrer',
                confidence: 'high',
                reason: 'Tekstbeskrivelsen "Bankgebyrer" matcher direkte konto 7120 Bankgebyrer. Eva har set 11 lignende posteringer i 2025.',
                sources: ['Konto-stamdata: 7120 = Bankgebyrer', '11 historiske posteringer med samme tekst'],
            },
        },
    },
    { id: 9, bilag: 9, dato: '20.01.2026', tekst: 'Salg konsulent – Faktura 2026-03', konto: '1020 Konsulentsalg', modkonto: '5810 Bankkonto', debit: 0, kredit: 25000, moms: 'U25' },
    { id: 10, bilag: 10, dato: '22.01.2026', tekst: 'Taxa fra lufthavn', konto: '6210 Rejseudgifter', modkonto: '5810 Bankkonto', debit: 380, kredit: 0, moms: 'I25' },
    { id: 11, bilag: 11, dato: '25.01.2026', tekst: 'Telefonregning januar', konto: '6310 Husleje', modkonto: '5810 Bankkonto', debit: 1250, kredit: 0, moms: 'I25' },
    {
        id: 12, bilag: 12, dato: '27.01.2026', tekst: 'Kursusgebyr – Bogføring 2026',
        konto: '6610 Kurser', modkonto: '5810 Bankkonto', debit: 4500, kredit: 0, moms: 'I25',
        aiSuggestions: {
            konto: {
                value: '6610 Kurser',
                confidence: 'high',
                reason: 'Tekstbeskrivelsen indeholder "Kursusgebyr" som matcher konto 6610 Kurser direkte. Beløbet ligger inden for normalt interval (1.500–8.000 kr) for kurser.',
                sources: ['Konto-stamdata: 6610 = Kurser', 'Tidligere kursusposter i 2025 (alle på 6610)'],
            },
            moms: {
                value: 'I25',
                confidence: 'low',
                reason: 'Kurser har normalt I25 moms, men nogle uddannelseskurser er momsfri (særligt grundlæggende erhvervsuddannelse). Verificer mod fakturaen om kurset er momspligtigt.',
                sources: ['Konto 6610 standard: I25', 'SKAT-vejledning: § 13 stk. 1 nr. 3 — momsfri uddannelse'],
            },
        },
    },
    { id: 13, bilag: 13, dato: '29.01.2026', tekst: 'Salg konsulent – Faktura 2026-04', konto: '1020 Konsulentsalg', modkonto: '5810 Bankkonto', debit: 0, kredit: 18750, moms: 'U25' },
    { id: 14, bilag: 14, dato: '30.01.2026', tekst: 'Webhosting januar', konto: '6520 Software', modkonto: '5810 Bankkonto', debit: 199, kredit: 0, moms: 'I25' },
    { id: 15, bilag: 15, dato: '31.01.2026', tekst: 'Strøm december', konto: '6320 El & varme', modkonto: '5810 Bankkonto', debit: 2100, kredit: 0, moms: 'I25' },
];

const fmtKr = (n: number) =>
    new Intl.NumberFormat('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + ' kr';

// ---------- Eva chat types ----------

type KpiPart = { kind: 'kpi'; label: string; value: string; sub?: string };
type TablePart = { kind: 'table'; headers: string[]; rows: string[][] };
type ListPart = { kind: 'list'; title: string; items: { label: string; value: string; bar?: number }[] };
type ActionsPart = { kind: 'actions'; actions: { label: string; appearance?: 'primary' | 'default' | 'ghost'; onClick?: () => void }[] };

type Part = { kind: 'text'; text: string } | KpiPart | TablePart | ListPart | ActionsPart;

type Message = { id: number; from: 'user' | 'eva'; parts: Part[]; createdAt?: number };

type Conversation = {
    id: number;
    title: string;
    messages: Message[];
    updatedAt: number;
    archived?: boolean;
};

// Date buckets for navigating conversation history.
const CONV_GROUP_ORDER = ['I dag', 'I går', 'Sidste 7 dage', 'Ældre'] as const;
type ConvGroup = (typeof CONV_GROUP_ORDER)[number];

function conversationDateGroup(ts: number): ConvGroup {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const today = start.getTime();
    if (ts >= today) return 'I dag';
    if (ts >= today - 86400000) return 'I går';
    if (ts >= today - 6 * 86400000) return 'Sidste 7 dage';
    return 'Ældre';
}

// ---------- App ----------

let nextMsgId = 1000;
let nextConvId = 100;

// Status line shown next to the morphing mark while Eva "thinks" — cycles so it
// reads like Eva is narrating what it's doing (ported from the eva-work prototype).
const THINK_PHRASES = ['Tænker…', 'Kigger i kassekladden…', 'Samler data…', 'Skriver svar…'];

// ─── Gemini (real AI answers via the /api/gemini dev proxy) ─────────────────
// Ported from eva-advisor. The key comes from .env (VITE_GEMINI_API_KEY) and is
// only used locally through Vite's proxy — never commit .env / never deploy this.
const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_MODELS = ['gemini-3.1-flash-lite-preview', 'gemini-2.5-flash'];
const EVA_SYSTEM_PROMPT = [
    'Du er EVA, e-conomics AI-assistent til bogføring og regnskab.',
    'Svar altid på dansk — kort, konkret og venligt, gerne med punktopstilling ved lister.',
    'Dette er en tidlig prototype: du har endnu IKKE adgang til brugerens rigtige regnskabsdata.',
    'Hvis du bliver spurgt om konkrete tal, bilag eller posteringer, så sig kort at data-integrationen er på vej,',
    'og giv et generelt fagligt svar hvor det giver mening. Find aldrig på specifikke beløb eller bilagsnumre.',
].join(' ');

// Data-aware prompt (Phase 2): used when real e-conomic data is attached as context.
const EVA_DATA_SYSTEM_PROMPT = [
    'Du er EVA, e-conomics AI-assistent til bogføring og regnskab.',
    'Svar altid på dansk — kort, konkret og venligt, gerne med punktopstilling ved lister.',
    'Brug KUN de vedlagte data nedenfor til at svare — gæt aldrig og find aldrig på tal, bilag, konti eller kunder.',
    'Hvis svaret ikke kan udledes af de vedlagte data, så sig det ærligt.',
    'Formater beløb i dansk notation (fx 12.500 kr). Start ikke med at præsentere dig selv — gå direkte til svaret.',
].join(' ');

type GeminiTurn = { role: 'user' | 'model'; text: string };

async function askGemini(history: GeminiTurn[], systemPrompt: string = EVA_SYSTEM_PROMPT): Promise<string> {
    if (!GEMINI_KEY) throw new Error('Gemini-nøglen mangler (VITE_GEMINI_API_KEY i .env).');
    // Gemini requires the first turn to be from the user.
    const turns = [...history];
    while (turns.length && turns[0].role === 'model') turns.shift();
    const body = JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
        generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
    });
    for (const model of GEMINI_MODELS) {
        try {
            const res = await fetch(`/api/gemini/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
            });
            if (!res.ok) continue;
            const json = await res.json();
            const text: string = (json?.candidates?.[0]?.content?.parts ?? [])
                .map((p: { text?: string }) => p.text ?? '')
                .join('');
            if (text.trim()) return text.trim();
        } catch {
            /* try next model */
        }
    }
    throw new Error('Kunne ikke få svar fra Gemini.');
}

const greetingMessage: Message = {
    id: 1,
    from: 'eva',
    createdAt: Date.now(),
    parts: [
        {
            kind: 'text',
            text:
                'Hej, jeg hedder EVA\n\n' +
                "Jeg er e-conomic's nye AI-assistent. Jeg er i øjeblikket i alpha, hvilket " +
                'betyder at jeg testes med et begrænset antal brugere - din oplevelse og dine ' +
                'spørgsmål er med til at forme, hvad jeg bliver. Lad venligst være med at dele ' +
                'personlige oplysninger med mig, da vi gerne vil gemme dine spørgsmål til ' +
                'træningsformål. Jeg kan hjælpe med spørgsmål inden for din aftale i e-conomic ' +
                'og slå regler og frister op for dig på skat.dk. Prøv et af forslagene nedenfor — eller skriv selv.',
        },
    ],
};

const NOW = Date.now();
const seedConversations: Conversation[] = [
    {
        id: 1,
        title: 'Ny samtale',
        messages: [greetingMessage],
        updatedAt: NOW,
    },
    {
        id: 2,
        title: 'Rejseudgifter januar',
        messages: [
            { id: 11, from: 'user', parts: [{ kind: 'text', text: 'Hvor meget har vi brugt på rejser i januar?' }] },
            {
                id: 12,
                from: 'eva',
                createdAt: NOW - 3 * 60 * 60 * 1000,
                parts: [
                    { kind: 'text', text: 'I januar 2026 har I brugt **8.030 kr** på rejser fordelt på 3 posteringer på konto 6210 Rejseudgifter.' },
                    { kind: 'kpi', label: 'Rejseudgifter januar', value: '8.030 kr', sub: '3 posteringer · konto 6210' },
                ],
            },
        ],
        updatedAt: NOW - 3 * 60 * 60 * 1000, // 3 hours ago
    },
    {
        id: 3,
        title: 'Manglende godkendelser',
        messages: [
            { id: 21, from: 'user', parts: [{ kind: 'text', text: 'Hvilke posteringer mangler godkendelse?' }] },
            {
                id: 22,
                from: 'eva',
                createdAt: NOW - 24 * 60 * 60 * 1000,
                parts: [
                    { kind: 'text', text: 'Der er **3 posteringer** der mangler godkendelse fra dig før de kan bogføres.' },
                ],
            },
        ],
        updatedAt: NOW - 24 * 60 * 60 * 1000, // 1 day ago
    },
    {
        id: 4,
        title: 'Kontering af software-abonnementer',
        messages: [
            { id: 31, from: 'user', parts: [{ kind: 'text', text: 'Hvilken konto bruger vi til Adobe og webhosting?' }] },
            {
                id: 32,
                from: 'eva',
                createdAt: NOW - 3 * 24 * 60 * 60 * 1000,
                parts: [
                    { kind: 'text', text: 'Begge bogføres på **6520 Software**. Adobe Creative Cloud (Bilag 7) og Webhosting januar (Bilag 14) deler den samme konto-mønster.' },
                ],
            },
        ],
        updatedAt: NOW - 3 * 24 * 60 * 60 * 1000, // 3 days ago
    },
];

function formatRelativeTime(ts: number): string {
    const diff = Date.now() - ts;
    const mins = Math.round(diff / 60000);
    if (mins < 1) return 'lige nu';
    if (mins < 60) return `${mins} min siden`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} time${hours === 1 ? '' : 'r'} siden`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days} dag${days === 1 ? '' : 'e'} siden`;
    return new Date(ts).toLocaleDateString('da-DK', { day: '2-digit', month: 'short' });
}

// Timestamp shown under an Eva reply: < 1 hour → "x minutter siden";
// 1 hour–1 day → time (14.32); older → date + time (7. jul. 14.32).
function formatMessageTime(ts: number): string {
    const diffMs = Date.now() - ts;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'lige nu';
    if (diffMin < 60) return `${diffMin} ${diffMin === 1 ? 'minut' : 'minutter'} siden`;
    const d = new Date(ts);
    const time = d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
    if (diffMs < 24 * 60 * 60 * 1000) return time;
    const date = d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
    return `${date} ${time}`;
}

function previewMessage(messages: Message[]): string {
    const last = [...messages].reverse().find((m) => m.parts.some((p) => p.kind === 'text'));
    if (!last) return '';
    const textPart = last.parts.find((p) => p.kind === 'text') as { kind: 'text'; text: string } | undefined;
    return textPart?.text.replace(/\*\*/g, '') ?? '';
}

export default function App() {
    const [postings, setPostings] = useState<Posting[]>(initialPostings);
    const [evaOpen, setEvaOpen] = useState(true); // open by default so Eva is visible on first load
    const [evaInput, setEvaInput] = useState('');
    const [contextRow, setContextRow] = useState<Posting | null>(null);
    const [contextField, setContextField] = useState<SuggestableField | null>(null);
    const [highlightedRowId, setHighlightedRowId] = useState<number | null>(null);
    const conversationEndRef = useRef<HTMLDivElement>(null);
    const evaInputRef = useRef<HTMLTextAreaElement>(null);
    // Cached real-data context for the Gemini prompt (loaded once per session).
    const snapshotContextRef = useRef<string | null>(null);
    const snapshotLoadingRef = useRef<Promise<string> | null>(null);

    const [conversations, setConversations] = useState<Conversation[]>(seedConversations);
    const [activeConversationId, setActiveConversationId] = useState<number | null>(1);
    const [openMenuConvId, setOpenMenuConvId] = useState<number | null>(null);
    const [renamingConvId, setRenamingConvId] = useState<number | null>(null);
    const [listTab, setListTab] = useState<'chats' | 'log' | 'flows'>('chats');
    const [convQuery, setConvQuery] = useState('');
    const [convFilter, setConvFilter] = useState<'active' | 'archived'>('active');
    const [searchOpen, setSearchOpen] = useState(false);
    const [sortOpen, setSortOpen] = useState(false);
    const [sortMode, setSortMode] = useState<'newest' | 'oldest' | 'title'>('newest');

    // Eva "thinking" state — while true, the morphing mark + a cycling status line
    // are shown in the conversation until the reply lands.
    const [thinking, setThinking] = useState(false);
    const [thinkDelay, setThinkDelay] = useState(0); // random negative offset → different start shape each send
    const [thinkPhrase, setThinkPhrase] = useState(0);

    // Resizable chat panel width (px), dragged via a handle on the drawer's left edge.
    const [chatWidth, setChatWidth] = useState(420);
    const [resizing, setResizing] = useState(false);

    // While thinking, advance the status line every 700ms (stops at the last phrase).
    useEffect(() => {
        if (!thinking) return;
        setTimeout(() => conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
        const id = setInterval(() => {
            setThinkPhrase((p) => Math.min(p + 1, THINK_PHRASES.length - 1));
        }, 700);
        return () => clearInterval(id);
    }, [thinking]);

    // Auto-grow the input field to fit the message (up to a max height, then scroll).
    useEffect(() => {
        const el = evaInputRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    }, [evaInput, evaOpen, activeConversationId]);

    // Make the chat resizable. Two taco elements carry the width and must stay in sync,
    // or the drawer clips (sizer wider than outlet) or leaves white space (outlet wider
    // than sizer): the OUTLET (flex item that reserves page space) and taco's inner
    // SIZER wrapper (has a fixed w-[420px] from the md size + the --drawer-swipe vars).
    // The panel fills the sizer on its own, so we leave it alone. Clear widths on close
    // so the drawer collapses; kill the transition while dragging so it tracks the pointer.
    useEffect(() => {
        const outlet = document.querySelector('[data-taco="drawer-outlet"]') as HTMLElement | null;
        const sizer = document.querySelector(
            '[data-taco="drawer-outlet"] [style*="--drawer-swipe-progress"]'
        ) as HTMLElement | null;
        [outlet, sizer].forEach((el) => {
            if (!el) return;
            el.style.transition = resizing ? 'none' : '';
            if (evaOpen) {
                el.style.width = chatWidth + 'px';
                el.style.maxWidth = 'none';
            } else {
                el.style.width = '';
                el.style.maxWidth = '';
            }
        });
    }, [evaOpen, chatWidth, resizing]);

    // Drag-to-resize: follow the pointer while a resize is in progress.
    useEffect(() => {
        if (!resizing) return;
        const onMove = (e: MouseEvent) => {
            const w = window.innerWidth - e.clientX;
            const max = Math.round(window.innerWidth * 0.4); // max 40% of screen width
            setChatWidth(Math.max(340, Math.min(max, w)));
        };
        const onUp = () => setResizing(false);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        const prevCursor = document.body.style.cursor;
        const prevSelect = document.body.style.userSelect;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        return () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.body.style.cursor = prevCursor;
            document.body.style.userSelect = prevSelect;
        };
    }, [resizing]);

    function commitRename(id: number, newTitle: string) {
        const trimmed = newTitle.trim();
        if (!trimmed) {
            setRenamingConvId(null);
            return;
        }
        setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: trimmed } : c)));
        setRenamingConvId(null);
    }
    function cancelRename() {
        setRenamingConvId(null);
    }

    const activeConversation = conversations.find((c) => c.id === activeConversationId) ?? null;
    const messages = activeConversation?.messages ?? [];

    function pushMessages(...newMsgs: Omit<Message, 'id'>[]) {
        const stamped = newMsgs.map((m) => ({ ...m, id: ++nextMsgId, createdAt: m.createdAt ?? Date.now() }));
        // First user message in a new "Ny samtale" conv → use it as the title
        const firstUserText = (() => {
            if (!activeConversation || activeConversation.title !== 'Ny samtale') return null;
            const userMsg = stamped.find((m) => m.from === 'user');
            const part = userMsg?.parts.find((p) => p.kind === 'text');
            return part && 'text' in part ? part.text : null;
        })();

        setConversations((prev) => {
            // No active conversation → create a new one
            if (!activeConversation) {
                const newConv: Conversation = {
                    id: ++nextConvId,
                    title: firstUserText?.slice(0, 40) || 'Ny samtale',
                    messages: stamped,
                    updatedAt: Date.now(),
                };
                setActiveConversationId(newConv.id);
                return [newConv, ...prev];
            }
            return prev.map((c) =>
                c.id === activeConversationId
                    ? {
                          ...c,
                          title: firstUserText ? firstUserText.slice(0, 40) : c.title,
                          messages: [...c.messages, ...stamped],
                          updatedAt: Date.now(),
                      }
                    : c
            );
        });
        setTimeout(() => conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }

    function startNewConversation() {
        const newConv: Conversation = {
            id: ++nextConvId,
            title: 'Ny samtale',
            messages: [{ ...greetingMessage, id: ++nextMsgId, createdAt: Date.now() }],
            updatedAt: Date.now(),
        };
        setConversations((prev) => [newConv, ...prev]);
        setActiveConversationId(newConv.id);
    }

    // Eva answers with a short "thinking" beat: the user's message lands now, Eva
    // shows the morphing mark + cycling status line, then the reply(-ies) arrive.
    function respond(userMsg: Omit<Message, 'id'> | null, ...evaMsgs: Omit<Message, 'id'>[]) {
        if (userMsg) pushMessages(userMsg);
        setThinkDelay(-(Math.random() * 5));
        setThinkPhrase(0);
        setThinking(true);
        setTimeout(() => {
            pushMessages(...evaMsgs);
            setThinking(false);
        }, 2000);
    }

    function clearSuggestion(rowId: number, field: SuggestableField) {
        setPostings((prev) =>
            prev.map((r) => {
                if (r.id !== rowId || !r.aiSuggestions) return r;
                const next = { ...r.aiSuggestions };
                delete next[field];
                const hasAny = Object.keys(next).length > 0;
                return { ...r, aiSuggestions: hasAny ? next : undefined };
            })
        );
    }

    function acceptSuggestion(rowId: number, field: SuggestableField) {
        // Keep the value, drop the AI marker → cell becomes a normal user-owned value
        clearSuggestion(rowId, field);
    }

    function declineSuggestion(rowId: number, field: SuggestableField) {
        // Drop the value AND the AI marker → cell becomes empty
        setPostings((prev) =>
            prev.map((r) => {
                if (r.id !== rowId) return r;
                const nextAi = r.aiSuggestions ? { ...r.aiSuggestions } : undefined;
                if (nextAi) delete nextAi[field];
                const hasAny = nextAi && Object.keys(nextAi).length > 0;
                return { ...r, [field]: '', aiSuggestions: hasAny ? nextAi : undefined };
            })
        );
    }

    function addPosting() {
        const nextBilag = Math.max(0, ...postings.map((p) => p.bilag)) + 1;
        const nextId = Math.max(0, ...postings.map((p) => p.id)) + 1;
        const today = '02.02.2026';
        const newRow: Posting = {
            id: nextId,
            bilag: nextBilag,
            dato: today,
            tekst: '',
            konto: '6210 Rejseudgifter',
            modkonto: '5810 Bankkonto',
            debit: 0,
            kredit: 0,
            moms: 'I25',
            aiSuggestions: {
                konto: {
                    value: '6210 Rejseudgifter',
                    confidence: 'high',
                    reason: 'Bilag der ligner dette (Bilag 4, 5, 10) er bogført på konto 6210 Rejseudgifter. Konto-mønsteret matcher de seneste 3 rejseposter i januar.',
                    sources: ['Bilag 4 — Flyrejse København–Berlin', 'Bilag 5 — Hotel Berlin', 'Bilag 10 — Taxa fra lufthavn'],
                },
                modkonto: {
                    value: '5810 Bankkonto',
                    confidence: 'high',
                    reason: 'Modkonto er 5810 Bankkonto i 13 ud af 15 posteringer denne måned — det er din standardkonto for udgifter betalt fra bankkontoen.',
                    sources: ['Mønster: 87% af januar-posteringer bruger 5810 Bankkonto', 'Konto-stamdata: 5810 er markeret som standard'],
                },
                moms: {
                    value: 'I25',
                    confidence: 'medium',
                    reason: 'Konto 6210 Rejseudgifter er typisk I25 (indgående moms 25%). Bemærk: udenlandsrejser kan kræve EU-moms i stedet — verificer hvis bilaget er fra udlandet.',
                    sources: ['Skattekonto-mapping: 6210 → I25 (standard)', 'Tidligere rejseposter: 100% I25'],
                },
            },
        };
        setPostings((prev) => [...prev, newRow]);
        pushMessages({
            from: 'eva',
            parts: [
                {
                    kind: 'text',
                    text: `Jeg har foreslået **Konto**, **Modkonto** og **Moms** til Bilag ${nextBilag}. Tab dig gennem cellerne for at acceptere — eller klik ✨ for at se hvorfor.`,
                },
            ],
        });
    }

    // ---------- canned Eva replies ----------

    function askTravel() {
        const travel = postings.filter((p) => p.konto.startsWith('6210'));
        const total = travel.reduce((s, p) => s + p.debit, 0);
        respond(
            { from: 'user', parts: [{ kind: 'text', text: 'Hvor meget har vi brugt på rejser i januar?' }] },
            {
                from: 'eva',
                parts: [
                    {
                        kind: 'text',
                        text: 'I januar 2026 har I brugt **8.030 kr** på rejser fordelt på 3 posteringer på konto 6210 Rejseudgifter:'.replace('8.030 kr', fmtKr(total)),
                    },
                    {
                        kind: 'kpi',
                        label: 'Rejseudgifter januar',
                        value: fmtKr(total),
                        sub: `${travel.length} posteringer · konto 6210`,
                    },
                    {
                        kind: 'table',
                        headers: ['Bilag', 'Dato', 'Tekst', 'Beløb'],
                        rows: travel.map((p) => [String(p.bilag), p.dato, p.tekst, fmtKr(p.debit)]),
                    },
                    {
                        kind: 'actions',
                        actions: [
                            { label: 'Filtrer kassekladden til konto 6210', appearance: 'primary' },
                            { label: 'Sammenlign med december', appearance: 'default' },
                        ],
                    },
                ],
            }
        );
    }

    function askMissingApprovals() {
        // Pretend bilag 6, 7, 12 mangler godkendelse
        const flagged = postings.filter((p) => [6, 7, 12].includes(p.bilag));
        respond(
            { from: 'user', parts: [{ kind: 'text', text: 'Hvilke posteringer mangler godkendelse?' }] },
            {
                from: 'eva',
                parts: [
                    { kind: 'text', text: 'Der er **3 posteringer** der mangler godkendelse fra dig før de kan bogføres:' },
                    {
                        kind: 'table',
                        headers: ['Bilag', 'Dato', 'Tekst', 'Beløb'],
                        rows: flagged.map((p) => [String(p.bilag), p.dato, p.tekst, fmtKr(p.debit)]),
                    },
                    { kind: 'text', text: 'Bilag 12 (Kursusgebyr) er over 4.000 kr og kræver derfor godkendelse fra en administrator.' },
                    {
                        kind: 'actions',
                        actions: [
                            { label: 'Godkend alle (3)', appearance: 'primary' },
                            { label: 'Vis kun disse i kassekladden', appearance: 'default' },
                        ],
                    },
                ],
            }
        );
    }

    function askTopExpenses() {
        // Aggregate debit by konto
        const byKonto = new Map<string, number>();
        for (const p of postings) {
            if (!p.konto.startsWith('5810') && !p.konto.startsWith('1020')) {
                byKonto.set(p.konto, (byKonto.get(p.konto) ?? 0) + p.debit);
            }
        }
        const ranked = [...byKonto.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
        const max = ranked[0]?.[1] ?? 1;
        respond(
            { from: 'user', parts: [{ kind: 'text', text: 'Top 5 udgiftskonti denne måned' }] },
            {
                from: 'eva',
                parts: [
                    { kind: 'text', text: 'De fem største udgiftskonti i januar 2026:' },
                    {
                        kind: 'list',
                        title: 'Top 5 udgiftskonti',
                        items: ranked.map(([k, v]) => ({
                            label: k,
                            value: fmtKr(v),
                            bar: Math.round((v / max) * 100),
                        })),
                    },
                    {
                        kind: 'actions',
                        actions: [
                            { label: 'Åbn kontoanalyse-rapport', appearance: 'primary' },
                            { label: 'Eksportér til Excel', appearance: 'default' },
                        ],
                    },
                ],
            }
        );
    }

    function askAboutRow(row: Posting) {
        setContextRow(row);
        setHighlightedRowId(row.id);
        setEvaOpen(true);
        const isTravel = row.konto.startsWith('6210');
        const isBank = row.konto.startsWith('7120');
        let analysis = `Posteringen debiterer **${fmtKr(row.debit)}** på ${row.konto} mod kredit på ${row.modkonto}. `;
        if (isBank) analysis += 'Det ligner en rutinepostering for bankgebyrer. Kontovalget passer; momsfri er korrekt for finansielle gebyrer.';
        else if (isTravel) analysis += 'Rejseudgifter trækkes typisk på konto 6210 — dét stemmer. Husk at bilaget skal vedhæftes for momsfradrag.';
        else analysis += 'Konto- og moms-valget ser korrekt ud i forhold til typen af udgift.';

        respond(
            {
                from: 'user',
                parts: [{ kind: 'text', text: `Er bilag ${row.bilag} (${row.tekst}) korrekt bogført?` }],
            },
            {
                from: 'eva',
                parts: [
                    { kind: 'text', text: analysis },
                    {
                        kind: 'kpi',
                        label: `Bilag ${row.bilag}`,
                        value: fmtKr(row.debit || row.kredit),
                        sub: `${row.dato} · ${row.konto}`,
                    },
                    {
                        kind: 'actions',
                        actions: [
                            { label: 'Marker som godkendt', appearance: 'primary' },
                            { label: 'Foreslå anden konto', appearance: 'default' },
                            { label: 'Vedhæft bilag', appearance: 'ghost' },
                        ],
                    },
                ],
            }
        );
    }

    function askAboutField(row: Posting, field: SuggestableField) {
        setContextRow(row);
        setContextField(field);
        setHighlightedRowId(row.id);
        setEvaOpen(true);
        const sug = row.aiSuggestions?.[field];
        const fieldLabel = field === 'konto' ? 'Konto' : field === 'modkonto' ? 'Modkonto' : 'Moms';
        const confidenceText = sug
            ? sug.confidence === 'high'
                ? 'høj sikkerhed'
                : sug.confidence === 'medium'
                  ? 'mellem sikkerhed'
                  : 'lav sikkerhed'
            : '';

        respond(
            {
                from: 'user',
                parts: [{ kind: 'text', text: `Mere om dit forslag på **${fieldLabel}** for Bilag ${row.bilag}?` }],
            },
            {
                from: 'eva',
                parts: [
                    {
                        kind: 'text',
                        text: sug
                            ? `Mit forslag for ${fieldLabel} er **${sug.value}** (${confidenceText}). ${sug.reason}`
                            : `${fieldLabel}-feltet er ikke længere et forslag — du har allerede taget stilling.`,
                    },
                    ...(sug
                        ? ([
                              {
                                  kind: 'actions' as const,
                                  actions: [
                                      { label: `Vis lignende posteringer`, appearance: 'default' as const },
                                      { label: `Skift til en anden ${fieldLabel.toLowerCase()}`, appearance: 'default' as const },
                                  ],
                              },
                          ] as Part[])
                        : []),
                ],
            }
        );
    }

    async function sendTyped() {
        const text = evaInput.trim();
        if (!text || thinking) return;
        setEvaInput('');
        // Demo/mock mode (no Gemini key — e.g. the public keyless Pages build):
        // give a friendly canned reply instead of erroring, and steer to the chips.
        if (!GEMINI_KEY) {
            respond(
                { from: 'user', parts: [{ kind: 'text', text }] },
                {
                    from: 'eva',
                    parts: [
                        {
                            kind: 'text',
                            text: 'Tak for spørgsmålet! Dette er en demo af EVA uden adgang til rigtige data. Prøv et af forslagene ovenfor for at se, hvordan EVA svarer med tal, tabeller og handlinger.',
                        },
                    ],
                }
            );
            return;
        }
        // Flatten the conversation so far into Gemini turns, then add the new question.
        const history: GeminiTurn[] = (activeConversation?.messages ?? [])
            .map((m) => ({ role: (m.from === 'eva' ? 'model' : 'user') as 'user' | 'model', text: partsToText(m.parts) }))
            .filter((t) => t.text.trim());
        history.push({ role: 'user', text });
        pushMessages({ from: 'user', parts: [{ kind: 'text', text }] });
        setThinkDelay(-(Math.random() * 5));
        setThinkPhrase(0);
        setThinking(true);
        try {
            // Ground EVA in real e-conomic data when credentials are present (loaded once, cached).
            let systemPrompt: string | undefined;
            if (hasEconomicCredentials()) {
                try {
                    if (snapshotContextRef.current == null) {
                        if (!snapshotLoadingRef.current) snapshotLoadingRef.current = loadSnapshot().then(buildContext);
                        snapshotContextRef.current = await snapshotLoadingRef.current;
                    }
                    if (snapshotContextRef.current) {
                        systemPrompt = `${EVA_DATA_SYSTEM_PROMPT}\n\n${snapshotContextRef.current}`;
                    }
                } catch {
                    /* couldn't load data → fall back to the no-data prompt */
                }
            }
            const answer = await askGemini(history, systemPrompt);
            pushMessages({ from: 'eva', parts: [{ kind: 'text', text: answer }] });
        } catch (e) {
            pushMessages({
                from: 'eva',
                parts: [{ kind: 'text', text: `Beklager, jeg kunne ikke svare lige nu. ${e instanceof Error ? e.message : ''}`.trim() }],
            });
        } finally {
            setThinking(false);
        }
    }

    // ── Chats tab: search + archive filter + sort + date grouping ──
    const convSearch = convQuery.trim().toLowerCase();
    const filteredConversations = conversations
        .filter((c) => (convFilter === 'archived' ? !!c.archived : !c.archived))
        .filter(
            (c) =>
                !convSearch ||
                c.title.toLowerCase().includes(convSearch) ||
                c.messages.some((m) => partsToText(m.parts).toLowerCase().includes(convSearch))
        );
    const sortCmp =
        sortMode === 'oldest'
            ? (a: Conversation, b: Conversation) => a.updatedAt - b.updatedAt
            : sortMode === 'title'
              ? (a: Conversation, b: Conversation) => a.title.localeCompare(b.title, 'da')
              : (a: Conversation, b: Conversation) => b.updatedAt - a.updatedAt;
    const sortedConversations = [...filteredConversations].sort(sortCmp);
    // Date groups only make sense for date sorts; title sort is a flat list.
    const useDateGroups = sortMode !== 'title';
    const convGroupOrder = sortMode === 'oldest' ? [...CONV_GROUP_ORDER].reverse() : [...CONV_GROUP_ORDER];
    const conversationGroups: { group: ConvGroup | null; items: Conversation[] }[] = useDateGroups
        ? convGroupOrder
              .map((group) => ({ group, items: sortedConversations.filter((c) => conversationDateGroup(c.updatedAt) === group) }))
              .filter((g) => g.items.length > 0)
        : [{ group: null, items: sortedConversations }];
    const sortLabel = sortMode === 'oldest' ? 'Ældste' : sortMode === 'title' ? 'Titel' : 'Nyeste';

    const renderConvRow = (c: Conversation) => (
        <div
            key={c.id}
            role="button"
            tabIndex={0}
            onClick={() => setActiveConversationId(c.id)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveConversationId(c.id);
                }
            }}
            className="group relative rounded p-2 hover:bg-grey-100 transition-colors cursor-pointer"
        >
            <div className="flex items-center justify-between gap-2">
                {renamingConvId === c.id ? (
                    <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                        <RenameInput
                            initialValue={c.title}
                            onCommit={(v) => commitRename(c.id, v)}
                            onCancel={cancelRename}
                            className="font-bold text-sm text-grey-darkest bg-white border border-grey-300 rounded px-1 py-0 w-full outline-none focus:ring-2 focus:ring-blue-300"
                        />
                    </div>
                ) : (
                    <div className="font-bold text-sm text-grey-darkest truncate">{c.title}</div>
                )}
                <div className="text-[11px] text-grey-dark shrink-0">{formatRelativeTime(c.updatedAt)}</div>
            </div>
            <div className="text-xs text-grey-dark truncate mt-0.5">{previewMessage(c.messages)}</div>
            <div
                className={
                    'absolute inset-y-0 right-0 flex items-center pl-10 pr-1.5 rounded-r bg-gradient-to-l from-grey-100 from-50% to-transparent transition-opacity ' +
                    (openMenuConvId === c.id ? 'opacity-100' : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto')
                }
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
            >
                <Menu
                    open={openMenuConvId === c.id}
                    onChange={(o) => setOpenMenuConvId(o ? c.id : null)}
                    trigger={
                        <button
                            type="button"
                            aria-label="Flere handlinger"
                            className="inline-flex items-center justify-center w-7 h-7 rounded bg-white border border-grey-300 text-grey-darkest hover:bg-grey-50 shadow-sm"
                        >
                            <Icon name="ellipsis-vertical" />
                        </button>
                    }
                >
                    <Menu.Content>
                        <Menu.Item onClick={() => setRenamingConvId(c.id)}>Omdøb</Menu.Item>
                        <Menu.Item onClick={() => setConversations((prev) => prev.map((x) => (x.id === c.id ? { ...x, archived: !x.archived } : x)))}>
                            {c.archived ? 'Fjern fra arkiv' : 'Arkivér'}
                        </Menu.Item>
                        <Menu.Item
                            onClick={() => {
                                setConversations((prev) => prev.filter((x) => x.id !== c.id));
                                if (activeConversationId === c.id) setActiveConversationId(null);
                            }}
                        >
                            Slet samtale
                        </Menu.Item>
                    </Menu.Content>
                </Menu>
            </div>
        </div>
    );

    return (
        <>
            <EvaLogoDefs />
            <Layout>
                <Layout.Top>
                    {({ toggleSidebar }) => (
                        <Header>
                            <Header.MenuButton onClick={toggleSidebar} />
                            <Header.Logo href="/">e-conomic</Header.Logo>
                            <Header.PrimaryNavigation>
                                <Header.Link href="/hjem">Hjem</Header.Link>
                                <Header.Link href="/salg">Salg</Header.Link>
                                <Header.Link href="/udgifter">Udgifter</Header.Link>
                                <Header.Link href="/regnskab" aria-current="page">Regnskab</Header.Link>
                                <Header.Link href="/rapporter">Rapporter</Header.Link>
                                <Header.Link href="/projekter">Projekter</Header.Link>
                            </Header.PrimaryNavigation>
                            <div className="ml-auto flex items-center gap-2 pr-2">
                                <button className="text-white hover:bg-white/10 w-9 h-9 rounded-full inline-flex items-center justify-center" aria-label="Søg">
                                    <Icon name="search-bold" />
                                </button>
                                <button className="text-white hover:bg-white/10 w-9 h-9 rounded-full inline-flex items-center justify-center" aria-label="Indbakke">
                                    <Icon name="inbox" />
                                </button>
                                <button className="text-white hover:bg-white/10 w-9 h-9 rounded-full inline-flex items-center justify-center" aria-label="Marketplace">
                                    <Icon name="market" />
                                </button>
                                <button className="text-white hover:bg-white/10 w-9 h-9 rounded-full inline-flex items-center justify-center" aria-label="Notifikationer">
                                    <Icon name="bell-solid" />
                                </button>
                                <button
                                    onClick={() => setEvaOpen(true)}
                                    aria-label="Åbn Eva — AI-assistent"
                                    className="group inline-flex items-center justify-center h-9 w-9 hover:w-[140px] overflow-hidden rounded-full text-white hover:bg-white/10 active:scale-95 transition-[width] duration-300"
                                >
                                    <EvaLogo mode="idle" size={24} className="shrink-0" />
                                    <span className="text-sm font-medium whitespace-nowrap overflow-hidden max-w-0 group-hover:max-w-[120px] group-hover:ml-2 transition-all duration-300">
                                        Spørg Eva
                                    </span>
                                </button>
                                <button
                                    className="text-white w-9 h-9 rounded-full inline-flex items-center justify-center hover:brightness-110"
                                    aria-label="Hjælp"
                                    style={{ backgroundColor: '#08AE87' }}
                                >
                                    <Icon name="question-mark-bold" />
                                </button>
                                <button
                                    className="text-white w-9 h-9 rounded-full inline-flex items-center justify-center hover:brightness-110"
                                    aria-label="Indstillinger"
                                    style={{ backgroundColor: '#E89C2E' }}
                                >
                                    <Icon name="settings-solid" />
                                </button>
                                <div className="mx-2 h-7 w-px bg-white/20" />
                                <button className="flex items-center gap-2 hover:bg-white/10 rounded px-2 py-1 text-white">
                                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/20 text-white">
                                        <Icon name="person-solid" />
                                    </span>
                                    <span className="flex flex-col items-start leading-tight whitespace-nowrap">
                                        <span className="text-sm font-medium">Carl Ejlers</span>
                                        <span className="text-xs text-white/70 inline-flex items-center gap-1.5">
                                            <span>1785252 VISMA</span>
                                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: '#3B82F6' }}>Admin</span>
                                        </span>
                                    </span>
                                    <Icon name="chevron-down-solid" />
                                </button>
                            </div>
                        </Header>
                    )}
                </Layout.Top>
                <div className="flex flex-grow overflow-hidden">
                    <Layout.Sidebar>
                        <Navigation2>
                            <Navigation2.Section>
                                <Navigation2.Group heading="Kassekladder" defaultExpanded>
                                    <Navigation2.Link href="/regnskab/daglig-kassekladde" active>
                                        Daglig kassekladde
                                    </Navigation2.Link>
                                    <Navigation2.Link href="/regnskab/lonkladde">Lønkladde</Navigation2.Link>
                                    <Navigation2.Link href="/regnskab/aben-postering">Åbne posteringer</Navigation2.Link>
                                </Navigation2.Group>
                                <Navigation2.Group heading="Bogføring" defaultExpanded>
                                    <Navigation2.Link href="/regnskab/finanskonti">Finanskonti</Navigation2.Link>
                                    <Navigation2.Link href="/regnskab/kontoplan">Kontoplan</Navigation2.Link>
                                    <Navigation2.Link href="/regnskab/saldobalance">Saldobalance</Navigation2.Link>
                                </Navigation2.Group>
                                <Navigation2.Group heading="Moms & afgifter" defaultExpanded>
                                    <Navigation2.Link href="/regnskab/momsafregning">Momsafregning</Navigation2.Link>
                                    <Navigation2.Link href="/regnskab/eu-salg">EU-salg uden moms</Navigation2.Link>
                                </Navigation2.Group>
                                <Navigation2.Group heading="Periode-afslutning">
                                    <Navigation2.Link href="/regnskab/aarsafslutning">Årsafslutning</Navigation2.Link>
                                    <Navigation2.Link href="/regnskab/efterposter">Efterposter</Navigation2.Link>
                                </Navigation2.Group>
                            </Navigation2.Section>
                        </Navigation2>
                    </Layout.Sidebar>
                    <Layout.Content>
                        <Layout.Page>
                            <div className="flex flex-col h-full w-full pt-6 px-6 pb-4 overflow-hidden">
                                <div className="mb-6">
                                    <h1 className="text-xl font-semibold text-grey-darkest whitespace-nowrap leading-none my-0">Daglig kassekladde</h1>
                                </div>
                                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                                    <Table3<Posting>
                                        id="kassekladde-table"
                                        data={postings}
                                        rowIdentityAccessor="id"
                                        enableSearch
                                        enableSorting
                                        enableFiltering
                                        enableColumnHiding
                                        enablePrinting
                                        enableEditing
                                        enableFooter
                                        onEditingSave={(row: Posting) => {
                                            setPostings((prev) =>
                                                prev.map((r) => {
                                                    if (r.id !== row.id) return r;
                                                    let nextAi = row.aiSuggestions ? { ...row.aiSuggestions } : undefined;
                                                    if (nextAi) {
                                                        (['konto', 'modkonto', 'moms'] as const).forEach((f) => {
                                                            if (nextAi![f] && row[f] !== nextAi![f]!.value) {
                                                                delete nextAi![f];
                                                            }
                                                        });
                                                        if (Object.keys(nextAi).length === 0) nextAi = undefined;
                                                    }
                                                    return { ...row, aiSuggestions: nextAi };
                                                })
                                            );
                                        }}
                                        toolbarLeft={
                                            <div className="flex items-center gap-2">
                                                <Button appearance="primary" onClick={addPosting}>Ny postering</Button>
                                                <Button>Bogfør posteringer</Button>
                                                <Menu trigger={<Button>Mere <Icon name="chevron-down-solid" /></Button>}>
                                                    <Menu.Content>
                                                        <Menu.Item>Eksportér til Excel</Menu.Item>
                                                        <Menu.Item>Importér posteringer</Menu.Item>
                                                        <Menu.Item>Slet kladde</Menu.Item>
                                                    </Menu.Content>
                                                </Menu>
                                            </div>
                                        }
                                        rowActions={[
                                            (row) => (
                                                <IconButton
                                                    icon="ai-stars"
                                                    tooltip="Spørg Eva om denne række"
                                                    onClick={() => askAboutRow(row as Posting)}
                                                />
                                            ),
                                            (row) => (
                                                <IconButton
                                                    icon="edit"
                                                    tooltip="Rediger"
                                                    onClick={() => console.log('edit', row)}
                                                />
                                            ),
                                            (row) => (
                                                <IconButton
                                                    icon="copy"
                                                    tooltip="Kopiér"
                                                    onClick={() => console.log('copy', row)}
                                                />
                                            ),
                                            (row) => (
                                                <IconButton
                                                    icon="delete"
                                                    tooltip="Slet"
                                                    onClick={() => setPostings((prev) => prev.filter((r) => r.id !== (row as Posting).id))}
                                                />
                                            ),
                                        ]}
                                    >
                                        <Table3.Column<Posting> accessor="bilag" header="Bilag" dataType="number" enableSorting />
                                        <Table3.Column<Posting> accessor="dato" header="Dato" enableSorting enableFiltering />
                                        <Table3.Column<Posting>
                                            accessor="tekst"
                                            header="Tekst"
                                            enableSorting
                                            enableFiltering
                                            enableEditing
                                            enableSearch
                                            control="input"
                                        />
                                        <Table3.Column<Posting>
                                            accessor="konto"
                                            header="Konto"
                                            enableSorting
                                            enableFiltering
                                            enableEditing
                                            control="input"
                                            renderer={({ row, value }) => (
                                                <AICellOrText
                                                    row={row as Posting}
                                                    field="konto"
                                                    value={String(value)}
                                                    onAccept={acceptSuggestion}
                                                    onDecline={declineSuggestion}
                                                    onAskEva={askAboutField}
                                                    fallbackClassName="text-blue-600"
                                                />
                                            )}
                                        />
                                        <Table3.Column<Posting>
                                            accessor="modkonto"
                                            header="Modkonto"
                                            enableSorting
                                            enableFiltering
                                            enableEditing
                                            control="input"
                                            renderer={({ row, value }) => (
                                                <AICellOrText
                                                    row={row as Posting}
                                                    field="modkonto"
                                                    value={String(value)}
                                                    onAccept={acceptSuggestion}
                                                    onDecline={declineSuggestion}
                                                    onAskEva={askAboutField}
                                                    fallbackClassName="text-blue-600"
                                                />
                                            )}
                                        />
                                        <Table3.Column<Posting>
                                            accessor="debit"
                                            header="Debet"
                                            dataType="amount"
                                            enableSorting
                                            enableEditing
                                            control="input"
                                        />
                                        <Table3.Column<Posting>
                                            accessor="kredit"
                                            header="Kredit"
                                            dataType="amount"
                                            enableSorting
                                            enableEditing
                                            control="input"
                                        />
                                        <Table3.Column<Posting>
                                            accessor="moms"
                                            header="Moms"
                                            enableSorting
                                            enableFiltering
                                            enableEditing
                                            control="input"
                                            renderer={({ row, value }) => (
                                                <AICellOrText
                                                    row={row as Posting}
                                                    field="moms"
                                                    value={String(value)}
                                                    onAccept={acceptSuggestion}
                                                    onDecline={declineSuggestion}
                                                    onAskEva={askAboutField}
                                                />
                                            )}
                                        />
                                    </Table3>
                                </div>
                            </div>
                        </Layout.Page>
                    </Layout.Content>
                    <Drawer.Outlet />
                </div>
            </Layout>

            <Drawer
                open={evaOpen}
                onChange={(o) => {
                    setEvaOpen(o);
                    if (!o) {
                        setContextRow(null);
                        setContextField(null);
                        setHighlightedRowId(null);
                        setThinking(false);
                    }
                }}
                size="md"
                variant="embedded"
                showCloseButton={false}
            >
                <Drawer.Content aria-label="Eva AI-assistent">
                    <div
                        role="separator"
                        aria-orientation="vertical"
                        aria-label="Træk for at ændre Eva-panelets bredde"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            setResizing(true);
                        }}
                        className="absolute left-0 inset-y-0 w-1.5 z-30 cursor-col-resize hover:bg-grey-300/70 transition-colors"
                    />
                    <div className="absolute right-3 top-3 z-20 flex items-center gap-1">
                        <span
                            className="mr-1 text-[13px] leading-5 px-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: '#E2DCFF', color: '#473279' }}
                        >
                            Alpha
                        </span>
                        <IconButton
                            icon="thumb-both"
                            appearance="discrete"
                            tooltip="Giv feedback"
                            aria-label="Giv feedback"
                            onClick={() => {}}
                        />
                        <IconButton
                            icon="close"
                            appearance="discrete"
                            tooltip="Luk"
                            aria-label="Luk"
                            onClick={() => {
                                setEvaOpen(false);
                                setContextRow(null);
                                setContextField(null);
                                setHighlightedRowId(null);
                                setThinking(false);
                            }}
                        />
                    </div>
                    <Drawer.Title className={'!text-base !py-4 !px-5 !pr-36 !items-center !bg-transparent' + (activeConversation ? '' : ' !border-b-0')}>
                        <span className="flex h-full items-center gap-2 leading-none min-w-0">
                            {activeConversation ? (
                                <IconButton
                                    icon="menu"
                                    appearance="discrete"
                                    aria-label="Vis samtaler"
                                    tooltip="Vis samtaler"
                                    onClick={() => setActiveConversationId(null)}
                                    className="shrink-0"
                                />
                            ) : (
                                <EvaLogo size={20} className="shrink-0" />
                            )}
                            {activeConversation ? (
                                <>
                                    <button
                                        onClick={() => setActiveConversationId(null)}
                                        className="font-semibold text-grey-darkest hover:underline shrink-0"
                                        title="Tilbage til samtaler"
                                    >
                                        EVA
                                    </button>
                                    <span className="text-grey-dark shrink-0">/</span>
                                    {renamingConvId === activeConversation.id ? (
                                        <RenameInput
                                            initialValue={activeConversation.title}
                                            onCommit={(v) => commitRename(activeConversation.id, v)}
                                            onCancel={cancelRename}
                                            className="font-medium text-grey-darkest text-base bg-white border border-grey-300 rounded px-1 py-0 outline-none focus:ring-2 focus:ring-blue-300 min-w-0 flex-1"
                                        />
                                    ) : (
                                        <span
                                            onDoubleClick={() => setRenamingConvId(activeConversation.id)}
                                            className="font-normal text-grey-dark truncate select-none cursor-text"
                                            title="Dobbeltklik for at omdøbe"
                                        >
                                            {activeConversation.title}
                                        </span>
                                    )}
                                </>
                            ) : (
                                <>
                                    <span className="font-semibold text-grey-darkest">EVA</span>
                                </>
                            )}
                        </span>
                    </Drawer.Title>
                    <div className="flex flex-col h-full min-h-0">
                        {!activeConversation ? (
                            <Tabs
                                id={listTab}
                                onChange={(id) => setListTab(id as 'chats' | 'log' | 'flows')}
                                className="flex flex-col flex-1 min-h-0"
                            >
                                <Tabs.List className="!px-4 !mb-0 shrink-0">
                                    <Tabs.Trigger id="chats">Chats</Tabs.Trigger>
                                    <Tabs.Trigger id="log">Log</Tabs.Trigger>
                                    <Tabs.Trigger id="flows">Flows</Tabs.Trigger>
                                </Tabs.List>
                                <Tabs.Content id="chats" className="flex-1 min-h-0 overflow-y-auto px-6 pt-3 pb-4">
                                    <button
                                        type="button"
                                        onClick={startNewConversation}
                                        className="flex items-center gap-2.5 w-full text-left rounded-lg px-3 py-2.5 mb-4 text-sm font-medium text-grey-darkest hover:brightness-95 transition"
                                        style={{ background: 'rgba(15, 23, 42, 0.05)' }}
                                    >
                                        <Icon name="circle-plus" /> Ny samtale
                                    </button>
                                    {/* Controls: filter (left) · sort + search toggle (right) */}
                                    <div className="flex items-center justify-between gap-2 mb-3">
                                        <div className="flex items-center gap-1">
                                            {(['active', 'archived'] as const).map((f) => (
                                                <button
                                                    key={f}
                                                    type="button"
                                                    onClick={() => setConvFilter(f)}
                                                    className={
                                                        'rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
                                                        (convFilter === f ? 'bg-grey-200 text-grey-darkest' : 'text-grey-dark hover:bg-grey-100')
                                                    }
                                                >
                                                    {f === 'active' ? 'Aktive' : 'Arkiverede'}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-0.5 shrink-0">
                                            <Menu
                                                open={sortOpen}
                                                onChange={setSortOpen}
                                                trigger={
                                                    <button
                                                        type="button"
                                                        aria-label="Sortér"
                                                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-grey-dark hover:bg-grey-100"
                                                    >
                                                        {sortLabel}
                                                        <Icon name="chevron-down-solid" className="!h-3 !w-3" />
                                                    </button>
                                                }
                                            >
                                                <Menu.Content>
                                                    <Menu.Item onClick={() => setSortMode('newest')}>Nyeste først</Menu.Item>
                                                    <Menu.Item onClick={() => setSortMode('oldest')}>Ældste først</Menu.Item>
                                                    <Menu.Item onClick={() => setSortMode('title')}>Titel (A–Å)</Menu.Item>
                                                </Menu.Content>
                                            </Menu>
                                            <button
                                                type="button"
                                                aria-label="Søg i samtaler"
                                                onClick={() =>
                                                    setSearchOpen((o) => {
                                                        const next = !o;
                                                        if (!next) setConvQuery('');
                                                        return next;
                                                    })
                                                }
                                                className={
                                                    'inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ' +
                                                    (searchOpen ? 'bg-grey-100 text-grey-darkest' : 'text-grey-dark hover:bg-grey-100')
                                                }
                                            >
                                                <Icon name="search-bold" className="!h-4 !w-4" />
                                            </button>
                                        </div>
                                    </div>
                                    {/* Fold-out search */}
                                    {searchOpen && (
                                        <div className="relative mb-3">
                                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-grey-dark pointer-events-none">
                                                <Icon name="search-bold" className="!h-4 !w-4" />
                                            </span>
                                            <input
                                                autoFocus
                                                type="text"
                                                value={convQuery}
                                                onChange={(e) => setConvQuery(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Escape') {
                                                        setConvQuery('');
                                                        setSearchOpen(false);
                                                    }
                                                }}
                                                placeholder="Søg i samtaler…"
                                                className="w-full rounded-lg border border-grey-300 bg-white pl-8 pr-8 py-2 text-sm text-grey-darkest focus:outline-none focus:ring-2 focus:ring-blue-300"
                                            />
                                            {convQuery && (
                                                <button
                                                    type="button"
                                                    aria-label="Ryd søgning"
                                                    onClick={() => setConvQuery('')}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-grey-dark hover:text-grey-darkest"
                                                >
                                                    <Icon name="close" className="!h-4 !w-4" />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    {/* Grouped list / empty state */}
                                    {filteredConversations.length === 0 ? (
                                        <div className="text-center text-sm text-grey-dark py-8">
                                            {convSearch
                                                ? `Ingen samtaler matcher "${convQuery.trim()}".`
                                                : convFilter === 'archived'
                                                  ? 'Ingen arkiverede samtaler.'
                                                  : 'Ingen samtaler endnu.'}
                                        </div>
                                    ) : (
                                        conversationGroups.map(({ group, items }) => (
                                            <div key={group ?? 'all'} className="mb-3">
                                                {group && (
                                                    <div className="px-1 pb-1.5 text-[10px] uppercase tracking-wider font-semibold text-grey-dark">{group}</div>
                                                )}
                                                <div className="space-y-1">{items.map(renderConvRow)}</div>
                                            </div>
                                        ))
                                    )}
                                </Tabs.Content>
                                <Tabs.Content id="log" className="flex-1 min-h-0 overflow-y-auto px-6 py-12">
                                    <div className="flex flex-col items-center text-center gap-3 text-grey-dark">
                                        <EvaLogo size={28} />
                                        <p className="text-sm m-0 max-w-[220px]">Ingen log endnu. Handlinger EVA udfører vises her.</p>
                                    </div>
                                </Tabs.Content>
                                <Tabs.Content id="flows" className="flex-1 min-h-0 overflow-y-auto px-6 py-12">
                                    <div className="flex flex-col items-center text-center gap-3 text-grey-dark">
                                        <EvaLogo size={28} />
                                        <p className="text-sm m-0 max-w-[220px]">Flows kommer snart.</p>
                                    </div>
                                </Tabs.Content>
                            </Tabs>
                        ) : (
                          <>
                        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3 space-y-4">
                            {messages.map((m) => (
                                <ChatMessage key={m.id} message={m} />
                            ))}
                            {thinking && (
                                <div
                                    className="eva-msg-thinking"
                                    aria-label="Eva tænker"
                                    role="status"
                                    style={{ '--eva-think-delay': `${thinkDelay.toFixed(2)}s` } as React.CSSProperties}
                                >
                                    <EvaLogo size={28} />
                                    <span className="eva-msg-thinking-text">{THINK_PHRASES[thinkPhrase]}</span>
                                </div>
                            )}
                            <div ref={conversationEndRef} />
                        </div>
                        <Drawer.Footer className="!px-5 !border-t-0">
                            <div className="flex flex-col gap-2 w-full">
                                {/* All-in-one input field (mirrors the "Eva — always available" EvaInputCard):
                                    context chip → textarea → bottom row with scrollable chips + inline send. */}
                                <div
                                    className="rounded-xl"
                                    style={{ background: 'linear-gradient(180deg, #F2F3F5 0%, #E8EAEE 100%)' }}
                                >
                                    {contextRow && (
                                        <div className="px-3 pt-3 flex">
                                            <span
                                                className="max-w-full inline-flex items-center gap-1.5 rounded border px-3 py-1 text-xs"
                                                style={{ backgroundColor: '#F3F4F6', borderColor: '#E1E1E1', color: '#424242' }}
                                            >
                                                <EvaLogo size={14} />
                                                <span className="truncate">
                                                    Kontekst:{' '}
                                                    {contextField && (
                                                        <>
                                                            <strong>
                                                                {contextField === 'konto' ? 'Konto' : contextField === 'modkonto' ? 'Modkonto' : 'Moms'}
                                                            </strong>
                                                            {' i '}
                                                        </>
                                                    )}
                                                    <strong>Bilag {contextRow.bilag}</strong> — {contextRow.tekst}
                                                </span>
                                                <button
                                                    type="button"
                                                    aria-label="Ryd kontekst"
                                                    className="inline-flex items-center justify-center w-4 h-4 rounded text-grey-dark hover:bg-grey-200 shrink-0"
                                                    onClick={() => {
                                                        setContextRow(null);
                                                        setContextField(null);
                                                        setHighlightedRowId(null);
                                                    }}
                                                >
                                                    <Icon name="close" className="!h-3 !w-3" />
                                                </button>
                                            </span>
                                        </div>
                                    )}
                                    <textarea
                                        ref={evaInputRef}
                                        rows={1}
                                        className="w-full resize-none bg-transparent px-4 pt-3 pb-2 text-sm text-grey-darkest leading-5 max-h-40 overflow-y-auto focus:outline-none"
                                        placeholder="Skriv din besked…"
                                        value={evaInput}
                                        onChange={(e) => setEvaInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                sendTyped();
                                            }
                                        }}
                                    />
                                    <div className="flex items-end gap-2 px-3 pb-3 pt-1">
                                        <div className="grow min-w-0">
                                            <SuggestionChipBar
                                                chips={[
                                                    { label: 'Rejseudgifter januar', onClick: askTravel },
                                                    { label: 'Manglende godkendelser', onClick: askMissingApprovals },
                                                    { label: 'Top 5 udgiftskonti', onClick: askTopExpenses },
                                                ]}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            aria-label="Send"
                                            onClick={sendTyped}
                                            disabled={!evaInput.trim() || thinking}
                                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-white shrink-0 transition-opacity disabled:cursor-not-allowed"
                                            style={{ backgroundColor: '#2F5DBD', opacity: !evaInput.trim() || thinking ? 0.5 : 1 }}
                                        >
                                            <Icon name="arrow-up" className="!h-4 !w-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="text-center text-[11px] text-grey-dark">EVA er en AI assistent og kan lave fejl.</div>
                            </div>
                        </Drawer.Footer>
                          </>
                        )}
                    </div>
                </Drawer.Content>
            </Drawer>

            {/* Highlight selected row when in Eva context */}
            {highlightedRowId !== null && (
                <style>{`
                    [data-row-identity-value="${highlightedRowId}"] {
                        background-color: rgba(124, 58, 237, 0.08) !important;
                    }
                `}</style>
            )}
        </>
    );
}

// ---------- Chat message component ----------

function partsToText(parts: Part[]): string {
    return parts
        .map((p) => {
            if (p.kind === 'text') return p.text.replace(/\*\*/g, '');
            if (p.kind === 'kpi') return `${p.label}: ${p.value}${p.sub ? ` (${p.sub})` : ''}`;
            if (p.kind === 'list') return `${p.title}\n` + p.items.map((it) => `· ${it.label}: ${it.value}`).join('\n');
            if (p.kind === 'table') return [p.headers.join('\t'), ...p.rows.map((r) => r.join('\t'))].join('\n');
            return '';
        })
        .filter(Boolean)
        .join('\n\n');
}

function ChatMessage({ message }: { message: Message }) {
    const isUser = message.from === 'user';
    const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
    const [copied, setCopied] = useState(false);

    function copyReply() {
        void navigator.clipboard?.writeText(partsToText(message.parts));
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }

    const btn = 'eva-msg-action inline-flex items-center justify-center w-6 h-6 rounded hover:bg-grey-100 transition-colors';

    return (
        <div className={'group flex flex-col ' + (isUser ? 'items-end' : 'items-start')}>
            <div
                style={isUser ? { backgroundColor: '#BEBEBE', color: '#1C1C1C' } : { color: '#1C1C1C' }}
                className={
                    isUser
                        ? 'max-w-[80%] rounded-lg px-4 py-3 text-sm leading-5'
                        : 'w-full text-sm leading-5 space-y-3'
                }
            >
                {message.parts.map((part, i) => (
                    <PartView key={i} part={part} />
                ))}
            </div>
            {!isUser && (
                <div className="mt-1 min-h-6">
                    {/* Feedback + copy + timestamp reveal on hover over the response (like a chat assistant). */}
                    <div className="flex items-center gap-0.5 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto">
                        <button
                            type="button"
                            aria-label="God besvarelse"
                            aria-pressed={feedback === 'up'}
                            onClick={() => setFeedback((f) => (f === 'up' ? null : 'up'))}
                            className={btn}
                        >
                            <Icon name={feedback === 'up' ? 'thumb-up-solid' : 'thumb-up'} />
                        </button>
                        <button
                            type="button"
                            aria-label="Dårlig besvarelse"
                            aria-pressed={feedback === 'down'}
                            onClick={() => setFeedback((f) => (f === 'down' ? null : 'down'))}
                            className={btn}
                        >
                            <Icon name={feedback === 'down' ? 'thumb-down-solid' : 'thumb-down'} />
                        </button>
                        <button
                            type="button"
                            aria-label={copied ? 'Kopieret' : 'Kopiér svar'}
                            title={copied ? 'Kopieret' : 'Kopiér svar'}
                            onClick={copyReply}
                            className={btn}
                        >
                            <Icon name={copied ? 'tick' : 'copy'} />
                        </button>
                        {message.createdAt != null && (
                            <span className="ml-1.5 text-[11px] text-grey-400 select-none">
                                {formatMessageTime(message.createdAt)}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function PartView({ part }: { part: Part }) {
    if (part.kind === 'text') {
        const segs = part.text.split(/\*\*(.+?)\*\*/g);
        return (
            <div className="leading-5 whitespace-pre-line">
                {segs.map((seg, i) =>
                    i % 2 === 1 ? (
                        <strong key={i} className="font-semibold">
                            {seg}
                        </strong>
                    ) : (
                        <span key={i}>{seg}</span>
                    )
                )}
            </div>
        );
    }
    if (part.kind === 'kpi') {
        return (
            <div className="rounded border border-grey-300 bg-white px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-grey-dark">{part.label}</div>
                <div className="text-xl font-semibold text-grey-darkest">{part.value}</div>
                {part.sub && <div className="text-xs text-grey-dark mt-0.5">{part.sub}</div>}
            </div>
        );
    }
    if (part.kind === 'table') {
        return (
            <div className="overflow-hidden rounded border border-grey-300">
                <table className="w-full text-xs">
                    <thead className="bg-grey-50">
                        <tr>
                            {part.headers.map((h) => (
                                <th key={h} className="px-2 py-1.5 text-left font-medium text-grey-dark">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {part.rows.map((row, i) => (
                            <tr key={i} className="border-t border-grey-200">
                                {row.map((cell, j) => (
                                    <td key={j} className="px-2 py-1.5">
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }
    if (part.kind === 'list') {
        return (
            <div>
                <div className="text-xs font-medium text-grey-dark mb-1.5">{part.title}</div>
                <div className="space-y-1.5">
                    {part.items.map((it, i) => (
                        <div key={i}>
                            <div className="flex items-center justify-between text-xs">
                                <span>{it.label}</span>
                                <span className="font-medium">{it.value}</span>
                            </div>
                            {it.bar !== undefined && (
                                <div className="mt-0.5 h-1.5 bg-grey-100 rounded">
                                    <div
                                        className="h-full rounded"
                                        style={{ width: `${it.bar}%`, backgroundColor: '#2F5DBD' }}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    if (part.kind === 'actions') {
        return (
            <div className="flex flex-wrap gap-2 pt-1">
                {part.actions.map((a, i) => (
                    <Button
                        key={i}
                        appearance={a.appearance ?? 'default'}
                        onClick={a.onClick}
                    >
                        {a.label}
                    </Button>
                ))}
            </div>
        );
    }
    return null;
}

type ChipDef = { label: string; onClick: () => void };

/* Suggestion chips inside the input field. Collapsed: chips that fit on one line
   plus a "+N" button (no scrollbar). Clicking "+N" expands to multiple lines. */
function SuggestionChipBar({ chips }: { chips: ChipDef[] }) {
    const [expanded, setExpanded] = useState(false);
    const [containerWidth, setContainerWidth] = useState(0);
    const [chipWidths, setChipWidths] = useState<number[]>([]);
    const [moreWidth, setMoreWidth] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const measureRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const m = measureRef.current;
        if (!m) return;
        const buttons = Array.from(m.querySelectorAll<HTMLButtonElement>('button'));
        const widths = buttons.map((b) => b.getBoundingClientRect().width);
        const more = widths.pop() ?? 0;
        setChipWidths(widths);
        setMoreWidth(more);
    }, [chips.length]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        setContainerWidth(el.getBoundingClientRect().width);
        const ro = new ResizeObserver((entries) => {
            for (const e of entries) setContainerWidth(e.contentRect.width);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const gap = 6; // tailwind gap-1.5
    let fitCount = chips.length;
    if (chipWidths.length === chips.length && containerWidth > 0) {
        const total = chipWidths.reduce((s, w, i) => s + w + (i > 0 ? gap : 0), 0);
        if (total > containerWidth) {
            fitCount = 0;
            let used = 0;
            for (let i = 0; i < chips.length; i++) {
                const next = used + (i > 0 ? gap : 0) + chipWidths[i];
                if (next + gap + moreWidth <= containerWidth) {
                    used = next;
                    fitCount = i + 1;
                } else {
                    break;
                }
            }
        }
    }
    const hiddenCount = chips.length - fitCount;
    const visible = expanded ? chips : chips.slice(0, fitCount);

    return (
        <>
            <div
                ref={measureRef}
                aria-hidden
                className="absolute flex gap-1.5 pointer-events-none opacity-0"
                style={{ left: -9999, top: -9999 }}
            >
                {chips.map((c) => (
                    <SuggestionChip key={c.label} onClick={() => {}}>{c.label}</SuggestionChip>
                ))}
                <button className="rounded-full border border-grey-300 bg-white px-3 py-1 text-xs text-grey-darkest inline-flex items-center gap-1.5 whitespace-nowrap">
                    +{Math.max(chips.length, 9)}
                </button>
            </div>
            <div
                ref={containerRef}
                className={'w-full ' + (expanded ? 'flex flex-wrap gap-1.5' : 'flex flex-nowrap gap-1.5 overflow-hidden')}
            >
                {visible.map((c) => (
                    <SuggestionChip key={c.label} onClick={c.onClick}>{c.label}</SuggestionChip>
                ))}
                {!expanded && hiddenCount > 0 && (
                    <button
                        className="rounded-full border border-grey-300 bg-white px-3 py-1 text-xs text-grey-darkest hover:bg-grey-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                        onClick={() => setExpanded(true)}
                        aria-label={`Vis ${hiddenCount} flere forslag`}
                    >
                        +{hiddenCount}
                    </button>
                )}
                {expanded && hiddenCount > 0 && (
                    <button
                        className="rounded-full border border-grey-300 bg-white px-3 py-1 text-xs text-grey-darkest hover:bg-grey-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                        onClick={() => setExpanded(false)}
                        aria-label="Vis færre forslag"
                    >
                        Vis færre
                    </button>
                )}
            </div>
        </>
    );
}

function SuggestionChip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
    return (
        <button
            className="rounded-full border border-grey-300 bg-white px-3 py-1 text-xs text-grey-darkest hover:bg-grey-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            onClick={onClick}
        >
            <EvaLogo size={12} />
            {children}
        </button>
    );
}

function RenameInput({
    initialValue,
    onCommit,
    onCancel,
    className,
}: {
    initialValue: string;
    onCommit: (newValue: string) => void;
    onCancel: () => void;
    className?: string;
}) {
    const [val, setVal] = useState(initialValue);
    const ref = useRef<HTMLInputElement>(null);
    useEffect(() => {
        ref.current?.focus();
        ref.current?.select();
    }, []);
    return (
        <input
            ref={ref}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                    e.preventDefault();
                    onCommit(val);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    onCancel();
                }
            }}
            onBlur={() => onCommit(val)}
            className={className}
        />
    );
}

// ---------- AI cell + reasoning popover ----------

function AICellOrText({
    row,
    field,
    value,
    onAccept,
    onDecline,
    onAskEva,
    fallbackClassName,
}: {
    row: Posting;
    field: SuggestableField;
    value: string;
    onAccept: (rowId: number, field: SuggestableField) => void;
    onDecline: (rowId: number, field: SuggestableField) => void;
    onAskEva: (row: Posting, field: SuggestableField) => void;
    fallbackClassName?: string;
}) {
    const sug = row.aiSuggestions?.[field];
    const isSuggested = !!sug && value === sug.value;
    if (isSuggested) {
        return (
            <AISuggestedCell
                row={row}
                field={field}
                suggestion={sug!}
                onAccept={onAccept}
                onDecline={onDecline}
                onAskEva={onAskEva}
                fallbackClassName={fallbackClassName}
            />
        );
    }
    if (!value) return <span className="text-grey-dark">—</span>;
    return <span className={fallbackClassName}>{value}</span>;
}

function AISuggestedCell({
    row,
    field,
    suggestion,
    onAccept,
    onDecline,
    onAskEva,
    fallbackClassName,
}: {
    row: Posting;
    field: SuggestableField;
    suggestion: AISuggestion;
    onAccept: (rowId: number, field: SuggestableField) => void;
    onDecline: (rowId: number, field: SuggestableField) => void;
    onAskEva: (row: Posting, field: SuggestableField) => void;
    fallbackClassName?: string;
}) {
    const [open, setOpen] = useState(false);
    const [popoverCoords, setPopoverCoords] = useState<{ left: number; top: number } | null>(null);
    const wrapRef = useRef<HTMLDivElement>(null);

    function togglePopover() {
        if (open) {
            setOpen(false);
            return;
        }
        const rect = wrapRef.current?.getBoundingClientRect();
        if (!rect) return;
        const popoverHeight = 270;
        const popoverWidth = 320;
        const spaceBelow = window.innerHeight - rect.bottom;
        const top = spaceBelow >= popoverHeight + 8
            ? rect.bottom + 4
            : rect.top - popoverHeight - 4;
        const left = Math.min(rect.left, window.innerWidth - popoverWidth - 8);
        setPopoverCoords({ left, top });
        setOpen(true);
    }

    return (
        <div ref={wrapRef} className="relative flex items-center w-full h-full">
            <div className="group flex items-center gap-1.5 w-full">
                <span className={'flex-1 truncate ' + (fallbackClassName ?? '')}>{suggestion.value}</span>
                <button
                    className={
                        'inline-flex items-center justify-center w-5 h-5 rounded text-grey-400 hover:bg-grey-100 hover:text-grey-dark shrink-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 ' +
                        (open ? 'opacity-100' : 'opacity-0')
                    }
                    aria-label="Forklar Eva's forslag"
                    onClick={(e) => {
                        e.stopPropagation();
                        togglePopover();
                    }}
                >
                    <Icon name="ai-stars" />
                </button>
            </div>
            {open && popoverCoords && (
                <AIReasoningPopover
                    coords={popoverCoords}
                    suggestion={suggestion}
                    onAccept={() => {
                        onAccept(row.id, field);
                        setOpen(false);
                    }}
                    onDecline={() => {
                        onDecline(row.id, field);
                        setOpen(false);
                    }}
                    onAskEva={() => {
                        onAskEva(row, field);
                        setOpen(false);
                    }}
                    onDismiss={() => setOpen(false)}
                />
            )}
        </div>
    );
}

function AIReasoningPopover({
    coords,
    suggestion,
    onAccept,
    onDecline,
    onAskEva,
    onDismiss,
}: {
    coords: { left: number; top: number };
    suggestion: AISuggestion;
    onAccept: () => void;
    onDecline: () => void;
    onAskEva: () => void;
    onDismiss: () => void;
}) {
    const confidenceLabel = {
        high: 'Høj sikkerhed',
        medium: 'Mellem sikkerhed',
        low: 'Lav sikkerhed',
    }[suggestion.confidence];

    return (
        <>
            <div
                className="fixed inset-0 z-30"
                onClick={(e) => {
                    e.stopPropagation();
                    onDismiss();
                }}
            />
            <div
                className="fixed z-40 w-80 rounded-lg border border-grey-300 bg-white shadow-lg p-3 text-xs text-grey-darkest"
                style={{ left: coords.left, top: coords.top }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-purple-100 text-purple-700">
                        <Icon name="ai-stars" />
                    </span>
                    <span className="font-semibold">Eva's forslag</span>
                    <span
                        className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: '#EDE9FE', color: '#5B21B6' }}
                    >
                        {confidenceLabel}
                    </span>
                </div>
                <div className="mb-2 leading-relaxed">{suggestion.reason}</div>
                {suggestion.sources.length > 0 && (
                    <div className="mb-3">
                        <div className="text-[11px] uppercase tracking-wide text-grey-dark mb-1">Kilder</div>
                        <ul className="space-y-0.5">
                            {suggestion.sources.map((s, i) => (
                                <li key={i} className="text-grey-darkest">· {s}</li>
                            ))}
                        </ul>
                    </div>
                )}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-grey-200">
                    <button
                        className="inline-flex items-center gap-1 text-purple-700 text-xs font-medium hover:underline"
                        onClick={onAskEva}
                    >
                        <Icon name="ai-stars" />
                        Spørg Eva
                    </button>
                    <div className="flex items-center gap-2">
                        <Button appearance="ghost" onClick={onDecline}>Afvis</Button>
                        <Button
                            appearance="primary"
                            onClick={onAccept}
                            style={{ backgroundColor: '#7C3AED', borderColor: '#7C3AED' }}
                        >
                            Accepter
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
}

