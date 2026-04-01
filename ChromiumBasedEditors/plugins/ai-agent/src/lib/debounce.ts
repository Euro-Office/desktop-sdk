export type DebouncedFn<T extends unknown[]> = {
  (...args: T): void;
  cancel: () => void;
};

export const debounce = <T extends unknown[]>(
  fn: (...args: T) => void,
  delay: number
): DebouncedFn<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const debounced = (...args: T) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };

  debounced.cancel = () => clearTimeout(timer);

  return debounced;
};
