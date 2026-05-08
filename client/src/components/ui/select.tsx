import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  id?: string;
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
}

type MenuPosition = {
  left: number;
  top?: number;
  bottom?: number;
  width: number;
  maxHeight: number;
};

const VIEWPORT_MARGIN = 12;
const MENU_GAP = 8;

export function Select({
  value,
  onValueChange,
  options,
  id,
  ariaLabel,
  placeholder,
  disabled = false,
  className,
  triggerClassName,
  menuClassName,
}: SelectProps) {
  const generatedId = useId();
  const listboxId = `${id ?? generatedId}-listbox`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  const enabledOptions = useMemo(
    () => options.filter((option) => !option.disabled),
    [options],
  );

  const findNextIndex = (currentIndex: number, direction: 1 | -1) => {
    if (enabledOptions.length === 0) {
      return -1;
    }

    if (currentIndex === -1) {
      return options.findIndex((option) => option.value === enabledOptions[direction === 1 ? 0 : enabledOptions.length - 1]?.value);
    }

    let nextIndex = currentIndex;
    do {
      nextIndex = (nextIndex + direction + options.length) % options.length;
    } while (options[nextIndex]?.disabled && nextIndex !== currentIndex);

    return nextIndex;
  };

  const updateMenuPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === "undefined") {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(rect.width, viewportWidth - VIEWPORT_MARGIN * 2);
    const left = Math.min(
      Math.max(rect.left, VIEWPORT_MARGIN),
      viewportWidth - width - VIEWPORT_MARGIN,
    );
    const spaceBelow = viewportHeight - rect.bottom - VIEWPORT_MARGIN - MENU_GAP;
    const spaceAbove = rect.top - VIEWPORT_MARGIN - MENU_GAP;
    const openUpward = spaceBelow < 220 && spaceAbove > spaceBelow;

    setMenuPosition({
      left,
      width,
      maxHeight: Math.max((openUpward ? spaceAbove : spaceBelow), 140),
      ...(openUpward
        ? { bottom: viewportHeight - rect.top + MENU_GAP }
        : { top: rect.bottom + MENU_GAP }),
    });
  };

  const openMenu = () => {
    if (disabled || options.length === 0) {
      return;
    }

    const selectedIndex = options.findIndex((option) => option.value === value && !option.disabled);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : findNextIndex(-1, 1));
    setIsOpen(true);
  };

  const closeMenu = () => {
    setIsOpen(false);
    setActiveIndex(-1);
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updateMenuPosition();

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        closeMenu();
      }
    };

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
        triggerRef.current?.focus();
      }
    };

    const handleReposition = () => {
      updateMenuPosition();
    };

    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("touchstart", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, options, value]);

  useEffect(() => {
    if (!isOpen || activeIndex < 0) {
      return;
    }

    const activeItem = menuRef.current?.querySelector<HTMLButtonElement>(`[data-index="${activeIndex}"]`);
    activeItem?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, isOpen]);

  const commitSelection = (nextValue: string) => {
    onValueChange(nextValue);
    closeMenu();
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }

    if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      if (!isOpen) {
        openMenu();
        if (event.key === "ArrowUp") {
          setActiveIndex(findNextIndex(-1, -1));
        }
      } else if (event.key === "ArrowDown") {
        setActiveIndex((current) => findNextIndex(current, 1));
      } else if (event.key === "ArrowUp") {
        setActiveIndex((current) => findNextIndex(current, -1));
      }
    }
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => findNextIndex(current, 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => findNextIndex(current, -1));
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(findNextIndex(-1, 1));
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(findNextIndex(-1, -1));
      return;
    }

    if (["Enter", " "].includes(event.key) && activeIndex >= 0) {
      event.preventDefault();
      const option = options[activeIndex];
      if (option && !option.disabled) {
        commitSelection(option.value);
      }
    }
  };

  const triggerLabel = selectedOption?.label ?? placeholder ?? "Select an option";

  return (
    <>
      <div className={cn("relative min-w-0", className)}>
        <button
          ref={triggerRef}
          id={id}
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          disabled={disabled}
          onClick={() => (isOpen ? closeMenu() : openMenu())}
          onKeyDown={handleTriggerKeyDown}
          className={cn(
            "flex h-12 w-full min-w-0 items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-white/95 px-4 text-left text-sm text-ink-900 shadow-sm transition",
            "hover:border-ink-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#0074B7]/20",
            "disabled:cursor-not-allowed disabled:opacity-60",
            triggerClassName,
          )}
        >
          <span className={cn("min-w-0 flex-1 truncate", !selectedOption && "text-ink-400")}>
            {triggerLabel}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-[#0074B7] transition-transform duration-200",
              isOpen && "rotate-180",
            )}
          />
        </button>
      </div>

      {isOpen && menuPosition && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              id={listboxId}
              role="listbox"
              aria-labelledby={id}
              tabIndex={-1}
              onKeyDown={handleMenuKeyDown}
              className={cn(
                "fixed z-[70] overflow-y-auto rounded-2xl border border-mint-200 bg-white/98 p-1 shadow-[0_22px_50px_-18px_rgba(10,15,26,0.45)] backdrop-blur-sm",
                menuClassName,
              )}
              style={{
                left: menuPosition.left,
                top: menuPosition.top,
                bottom: menuPosition.bottom,
                width: menuPosition.width,
                maxHeight: menuPosition.maxHeight,
              }}
            >
              {options.map((option, index) => {
                const isSelected = option.value === value;
                const isActive = index === activeIndex;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-index={index}
                    disabled={option.disabled}
                    onMouseEnter={() => {
                      if (!option.disabled) {
                        setActiveIndex(index);
                      }
                    }}
                    onClick={() => {
                      if (!option.disabled) {
                        commitSelection(option.value);
                      }
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition",
                      option.disabled
                        ? "cursor-not-allowed text-ink-300"
                        : "text-ink-800",
                      !option.disabled && isActive && "bg-mint-100 text-ink-900",
                      !option.disabled && !isActive && "hover:bg-mint-50",
                    )}
                  >
                    <span className="min-w-0 flex-1 break-words">{option.label}</span>
                    {isSelected ? <Check className="h-4 w-4 shrink-0 text-[#0074B7]" /> : null}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}