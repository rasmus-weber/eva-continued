// Real e-conomic data, fetched through the /api/economic dev proxy (see vite.config.ts).
// Ported/trimmed from eva-advisor. Auth tokens come from .env (VITE_ECONOMIC_*) and are
// only used locally via the proxy — never commit .env, never deploy this build.
/* eslint-disable @typescript-eslint/no-explicit-any */

const APP_SECRET = import.meta.env.VITE_ECONOMIC_APP_SECRET || '';
const GRANT_TOKEN = import.meta.env.VITE_ECONOMIC_GRANT_TOKEN || '';

const dkk = (v: number) =>
    new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }).format(v || 0);
const dkDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function ecHeaders(): Record<string, string> {
    return {
        'X-AppSecretToken': APP_SECRET,
        'X-AgreementGrantToken': GRANT_TOKEN,
        'Content-Type': 'application/json',
    };
}

async function fetchEC(path: string): Promise<any> {
    const res = await fetch(`/api/economic${path}`, { headers: ecHeaders() });
    if (!res.ok) throw new Error(`e-conomic ${path}: HTTP ${res.status}`);
    const json = await res.json();
    return json.collection || json.items || json;
}

export type Snapshot = {
    self?: any;
    accounts?: any[];
    customers?: any[];
    invoicesOverdue?: any[];
    journals?: any[];
};

export function hasEconomicCredentials(): boolean {
    return !!APP_SECRET && !!GRANT_TOKEN;
}

// Fetch a compact "financial snapshot" — tolerant of individual endpoint failures.
export async function loadSnapshot(): Promise<Snapshot> {
    const snap: Snapshot = {};
    const [self, accounts, customers, overdue, journals] = await Promise.all([
        fetchEC('/self').catch(() => null),
        fetchEC('/accounts?pageSize=1000').catch(() => null),
        fetchEC('/customers?pageSize=1000').catch(() => null),
        fetchEC('/invoices/overdue?pageSize=1000').catch(() => null),
        fetchEC('/journals').catch(() => null),
    ]);
    if (self) snap.self = self;
    if (Array.isArray(accounts)) snap.accounts = accounts;
    if (Array.isArray(customers)) snap.customers = customers;
    if (Array.isArray(overdue)) snap.invoicesOverdue = overdue;
    if (Array.isArray(journals)) {
        snap.journals = await Promise.all(
            journals.slice(0, 3).map(async (j: any) => {
                const nr = j.journalNumber ?? j.self?.split('/').pop();
                try {
                    const entries = await fetchEC(`/journals/${nr}/entries?pageSize=1000`);
                    return { ...j, entries: Array.isArray(entries) ? entries : [] };
                } catch {
                    return { ...j, entries: [] };
                }
            })
        );
    }
    return snap;
}

// Turn the snapshot into a compact Danish context block for the Gemini system prompt.
export function buildContext(s: Snapshot): string {
    const sec: string[] = [];
    if (s.self) {
        const co = s.self.company || {};
        sec.push(
            `=== VIRKSOMHEDSINFO ===\nNavn: ${co.name || s.self.companyName || '—'}\nAftalenr.: ${s.self.agreementNumber || '—'}\nCVR: ${
                co.companyIdentificationNumber || '—'
            }\nBy: ${co.city || '—'}`
        );
    }
    if (s.accounts?.length) {
        const bank = s.accounts.filter((a: any) => a.accountNumber >= 1010 && a.accountNumber <= 1099);
        const vat = s.accounts.filter((a: any) => a.accountNumber >= 5600 && a.accountNumber <= 5699);
        sec.push(
            `=== KONTI ===\nBankkonti:\n${(bank.length ? bank : s.accounts.slice(0, 5))
                .map((a: any) => `- ${a.accountNumber} ${a.name}: ${dkk(a.balance)}`)
                .join('\n')}\nMomskonti:\n${
                vat.length ? vat.map((a: any) => `- ${a.accountNumber} ${a.name}: ${dkk(a.balance)}`).join('\n') : '(ingen identificeret)'
            }`
        );
    }
    if (s.customers?.length) {
        const bal = s.customers.reduce((t: number, c: any) => t + Math.abs(c.balance || 0), 0);
        const od = s.customers.reduce((t: number, c: any) => t + (c.overdueAmount || 0), 0);
        sec.push(
            `=== KUNDER (${s.customers.length} stk.) ===\nSamlet debitorbalance: ${dkk(bal)}\nSamlet forfaldent: ${dkk(od)}\n${s.customers
                .slice(0, 40)
                .map((c: any) => `- ${c.name} | ${c.city || '—'} | Saldo: ${dkk(Math.abs(c.balance || 0))} | Forfaldent: ${dkk(c.overdueAmount || 0)}`)
                .join('\n')}`
        );
    }
    if (s.invoicesOverdue?.length) {
        const tot = s.invoicesOverdue.reduce((t: number, i: any) => t + (i.netAmountInBaseCurrency || i.restAmountInBaseCurrency || 0), 0);
        sec.push(
            `=== FORFALDNE FAKTURAER (${s.invoicesOverdue.length} stk.) ===\nSamlet forfaldent: ${dkk(tot)}\n${s.invoicesOverdue
                .slice(0, 40)
                .map(
                    (i: any) =>
                        `- #${i.bookedInvoiceNumber} | ${i.customer?.name || '—'} | forfald ${dkDate(i.dueDate)} | ${dkk(
                            i.netAmountInBaseCurrency || i.restAmountInBaseCurrency || 0
                        )}`
                )
                .join('\n')}`
        );
    }
    if (s.journals?.length) {
        const all = s.journals.flatMap((j: any) => j.entries || []);
        sec.push(
            `=== KLADDER / JOURNALER ===\nSamlet antal poster i kladder: ${all.length}\n${s.journals
                .map(
                    (j: any) =>
                        `Kladde: ${j.name} (nr. ${j.journalNumber}), ${(j.entries || []).length} poster\n` +
                        (j.entries || [])
                            .slice(0, 10)
                            .map((e: any) => `  · ${dkDate(e.date)} | ${e.account?.accountNumber || ''} ${e.account?.name || ''} | ${e.text || '—'} | ${dkk(e.amount || 0)}`)
                            .join('\n')
                )
                .join('\n')}`
        );
    }
    return sec.join('\n\n');
}
