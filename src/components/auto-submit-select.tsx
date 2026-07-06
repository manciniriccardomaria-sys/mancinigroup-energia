"use client";

type AutoSubmitSelectProps = {
  name: string;
  defaultValue?: string;
  options: Array<{ label: string; value: string }>;
  required?: boolean;
};

type AutoSubmitDateInputProps = {
  name: string;
  defaultValue?: string;
  required?: boolean;
};

function submitClosestForm(target: HTMLElement) {
  target.closest("form")?.requestSubmit();
}

export function AutoSubmitSelect({ name, defaultValue, options, required }: AutoSubmitSelectProps) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      required={required}
      onChange={(event) => submitClosestForm(event.currentTarget)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function AutoSubmitDateInput({ name, defaultValue, required }: AutoSubmitDateInputProps) {
  return (
    <input
      name={name}
      type="date"
      defaultValue={defaultValue}
      required={required}
      onChange={(event) => submitClosestForm(event.currentTarget)}
    />
  );
}
