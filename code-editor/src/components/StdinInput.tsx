interface StdinInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function StdinInput({
  value,
  onChange,
  disabled = false,
}: StdinInputProps) {
  return (
    <div className="stdin-input">
      <label htmlFor="stdin">Input (stdin):</label>
      <textarea
        id="stdin"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter input for your program..."
        disabled={disabled}
        rows={4}
      />
    </div>
  );
}
