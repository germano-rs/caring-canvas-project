import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

/** Masked dd/mm/yyyy input. Value/onChange use ISO "yyyy-mm-dd" (or ""). */
export function DateInput({
  value,
  onChange,
  className,
  id,
}: {
  value: string;
  onChange: (isoDate: string) => void;
  className?: string;
  id?: string;
}) {
  const isoToBr = (iso: string) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return y && m && d ? `${d}/${m}/${y}` : "";
  };

  const [text, setText] = useState(() => isoToBr(value));

  useEffect(() => {
    setText(isoToBr(value));
  }, [value]);

  const handle = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let masked = digits;
    if (digits.length > 4) masked = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) masked = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    setText(masked);

    if (digits.length === 8) {
      const d = digits.slice(0, 2);
      const m = digits.slice(2, 4);
      const y = digits.slice(4);
      onChange(`${y}-${m}-${d}`);
    } else if (digits.length === 0) {
      onChange("");
    }
  };

  return (
    <Input
      id={id}
      inputMode="numeric"
      placeholder="dd/mm/aaaa"
      value={text}
      onChange={(e) => handle(e.target.value)}
      className={className}
    />
  );
}
