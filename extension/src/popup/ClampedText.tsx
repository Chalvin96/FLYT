import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@flyt/ui";

export function ClampedText({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  const id = useId();
  const content = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const element = content.current;
    if (!element || expanded) return;
    const measure = () =>
      setOverflows(element.scrollHeight > element.clientHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [children, expanded]);

  return (
    <div className="space-y-2">
      <div
        id={id}
        ref={content}
        onFocusCapture={(event) => {
          if (expanded || !(event.target instanceof HTMLElement)) return;
          const boundary = event.currentTarget.getBoundingClientRect();
          const focused = event.target.getBoundingClientRect();
          if (
            event.currentTarget.scrollTop > 0 ||
            focused.bottom > boundary.bottom ||
            focused.top < boundary.top
          )
            setExpanded(true);
        }}
        className={
          expanded
            ? "whitespace-pre-wrap [overflow-wrap:anywhere]"
            : "line-clamp-3 whitespace-pre-wrap [overflow-wrap:anywhere]"
        }
      >
        {children}
      </div>
      {overflows && (
        <Button
          aria-controls={id}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Show less" : "Show all"} ${label}`}
          onClick={() => setExpanded(!expanded)}
          variant="link"
        >
          {expanded ? "Show less" : "Show all"}
        </Button>
      )}
    </div>
  );
}
