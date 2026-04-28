import * as RadixSelect from "@radix-ui/react-select";
import { useState } from "react";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string = string> {
  id?: string;
  value: T;
  options: SelectOption<T>[];
  onValueChange: (value: T) => void;
  className?: string;
  disabled?: boolean;
}

export function Select<T extends string = string>({
  id,
  value,
  options,
  onValueChange,
  className,
  disabled,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  const containerClass = [
    "select2",
    "select2-container",
    "select2-container--default",
    open && "select2-container--open",
    open && "select2-container--below",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <RadixSelect.Root
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      open={open}
      onOpenChange={setOpen}
      disabled={disabled}
    >
      <span className={containerClass}>
        <RadixSelect.Trigger
          id={id}
          className={`select2-selection select2-selection--single oo-select__trigger${className ? ` ${className}` : ""}`}
          aria-label={selected?.label}
        >
          <RadixSelect.Value asChild>
            <span className="select2-selection__rendered oo-select__value">
              {selected?.label ?? ""}
            </span>
          </RadixSelect.Value>
          <RadixSelect.Icon asChild>
            <span
              className="select2-selection__arrow oo-select__arrow"
              aria-hidden="true"
            >
              <b />
            </span>
          </RadixSelect.Icon>
        </RadixSelect.Trigger>
      </span>
      <RadixSelect.Portal>
        {/*
          Wrap Content in a container span so plugins.css cascade rules like
          `.select2-container--default .select2-dropdown` still match. The
          `.select2-container { max-height: 20px !important }` rule doesn't
          apply here because the span is display: inline by default and
          Content inside is position: absolute via Floating UI.
        */}
        <span className="select2 select2-container select2-container--default select2-container--open select2-container--below">
          <RadixSelect.Content
            className="select2-dropdown select2-dropdown--below oo-select__content"
            position="popper"
            sideOffset={-1}
          >
            <RadixSelect.Viewport className="select2-results select2-results__options oo-select__viewport">
              {options.map((option) => (
                <RadixSelect.Item
                  key={option.value}
                  value={option.value}
                  className="select2-results__option oo-select__item"
                >
                  <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </span>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
