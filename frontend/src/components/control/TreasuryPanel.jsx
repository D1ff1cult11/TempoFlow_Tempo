import React, { useEffect, useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { useWorkspace, actions } from '../../store/useWorkspace';
import { TOKENS, fxQuote, errorText } from '../../lib/tempo';
import { AsyncButton, Result, Field } from './ui';

export function TreasuryPanel() {
  const ws = useWorkspace();
  const [tokenIn, setTokenIn] = useState(TOKENS[0].address);
  const [tokenOut, setTokenOut] = useState(TOKENS[1].address);
  const [amount, setAmount] = useState('100');
  const [quote, setQuote] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let live = true;
    setQuote(null);
    if (tokenIn === tokenOut || !(Number(amount) > 0)) return;
    const t = setTimeout(async () => {
      try {
        const out = await fxQuote({ tokenIn, tokenOut, amount });
        if (live) setQuote({ out });
      } catch (e) {
        if (live) setQuote({ error: errorText(e) });
      }
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [tokenIn, tokenOut, amount]);

  const sel = (value, onChange) => (
    <select className="cp-select" value={value} onChange={(e) => onChange(e.target.value)}>
      {TOKENS.map((t) => (
        <option key={t.address} value={t.address}>
          {t.symbol}
        </option>
      ))}
    </select>
  );

  return (
    <div className="glass-panel cp-card cp-stack">
      <div>
        <div className="cp-title">
          <ArrowRightLeft size={18} /> Convert between stablecoins
        </div>
        <p className="cp-sub">
          Live quotes from Tempo's built-in Stablecoin DEX (no mock rate). Use it to top up the stablecoin a team or a
          contractor needs. Trades are protected by a 0.5% slippage limit.
        </p>
      </div>
      <div className="cp-form">
        <Field label="From">{sel(tokenIn, setTokenIn)}</Field>
        <Field label="Amount">
          <input className="cp-input" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="To">{sel(tokenOut, setTokenOut)}</Field>
        <AsyncButton
          disabled={!ws.company || tokenIn === tokenOut || !quote?.out}
          onClick={() => actions.convert({ tokenIn, tokenOut, amount })}
          onResult={setResult}
        >
          <ArrowRightLeft size={15} /> Convert
        </AsyncButton>
      </div>
      <div className="cp-note">
        {tokenIn === tokenOut
          ? 'Pick two different stablecoins.'
          : quote == null
            ? 'Getting a live quote…'
            : quote.error
              ? `No quote: ${quote.error}`
              : `You get about ${quote.out.toFixed(4)} (rate ${(quote.out / Number(amount)).toFixed(5)}).`}
      </div>
      <Result result={result} okText="Converted on the Stablecoin DEX." />
    </div>
  );
}
