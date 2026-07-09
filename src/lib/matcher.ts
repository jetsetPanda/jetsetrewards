// Matches synced transactions against open benefit windows using the
// per-benefit match_rules JSON. Produces suggestions, never silent usage —
// except high-confidence issuer statement-credit postings, which the sync
// layer may auto-confirm.

export interface MatchRule {
  merchant_regex?: string;
  direction?: "debit" | "credit";
  min_amount_cents?: number;
  max_amount_cents?: number;
}

export interface MatchRules {
  any: MatchRule[];
}

export interface TxnLike {
  amountCents: number;
  description: string;
}

function isDebit(amountCents: number): boolean {
  // Teller's sign convention can differ by institution/account type.
  // Default: purchases on credit-card accounts post as positive amounts.
  const sign = process.env.TELLER_DEBIT_SIGN === "negative" ? -1 : 1;
  return Math.sign(amountCents) === sign;
}

export function evaluateRules(
  rules: MatchRules | null | undefined,
  txn: TxnLike
): { matched: boolean; confidence: number; viaCredit: boolean } {
  if (!rules || !Array.isArray(rules.any)) {
    return { matched: false, confidence: 0, viaCredit: false };
  }
  let best = { matched: false, confidence: 0, viaCredit: false };
  for (const rule of rules.any) {
    if (rule.merchant_regex) {
      let re: RegExp;
      try {
        re = new RegExp(rule.merchant_regex, "i");
      } catch {
        continue; // bad regex in catalog data — skip rule, never crash sync
      }
      if (!re.test(txn.description || "")) continue;
    }
    if (rule.direction === "debit" && !isDebit(txn.amountCents)) continue;
    if (rule.direction === "credit" && isDebit(txn.amountCents)) continue;

    const abs = Math.abs(txn.amountCents);
    if (rule.min_amount_cents != null && abs < rule.min_amount_cents) continue;
    if (rule.max_amount_cents != null && abs > rule.max_amount_cents) continue;

    const viaCredit = rule.direction === "credit";
    // Statement-credit postings are near ground truth; spend matches are heuristic.
    const confidence = viaCredit ? 0.95 : rule.merchant_regex ? 0.7 : 0.4;
    if (confidence > best.confidence) {
      best = { matched: true, confidence, viaCredit };
    }
  }
  return best;
}
