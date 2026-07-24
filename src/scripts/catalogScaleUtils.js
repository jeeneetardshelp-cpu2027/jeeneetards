export function boundedInteger(value, fallback, { name, min, max }) {
  const raw = value == null || value === "" ? fallback : Number(value);
  if (!Number.isInteger(raw) || raw < min || raw > max)
    throw new Error(`${name} must be an integer from ${min} to ${max}; received ${JSON.stringify(value)}`);
  return raw;
}

export function chunks(rows, size) {
  if (!Number.isInteger(size) || size < 1) throw new Error("chunk size must be a positive integer");
  const out = [];
  for (let index = 0; index < rows.length; index += size)
    out.push(rows.slice(index, index + size));
  return out;
}

export function percentile(values, fraction) {
  if (!values.length) throw new Error("percentile requires at least one value");
  if (!(fraction > 0 && fraction <= 1)) throw new Error("percentile fraction must be > 0 and <= 1");
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

export function timingSummary(values) {
  return {
    samples: values.length,
    min_ms: Math.round(Math.min(...values)),
    median_ms: Math.round(percentile(values, 0.5)),
    p95_ms: Math.round(percentile(values, 0.95)),
    max_ms: Math.round(Math.max(...values)),
  };
}

export function scaleVideoKey(run, index) {
  if (!/^[0-9a-f]{6}$/.test(run)) throw new Error("run id must be six lowercase hex characters");
  if (!Number.isInteger(index) || index < 0 || index >= 36 ** 4)
    throw new Error("video index is outside the four-character base36 range");
  return `S${run}${index.toString(36).padStart(4, "0")}`;
}
