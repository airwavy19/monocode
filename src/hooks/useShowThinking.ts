import { useEffect, useState } from "react";
import {
  loadShowThinking,
  SHOW_THINKING_CHANGE_EVENT,
  type ShowThinking,
} from "../lib/settings";

/** Subscribes to the show-thinking toggle. "on" renders reasoning; "off" hides it. */
export function useShowThinking(): ShowThinking {
  const [value, setValue] = useState<ShowThinking>(() => loadShowThinking());
  useEffect(() => {
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<ShowThinking>).detail;
      setValue(detail === "off" ? "off" : "on");
    };
    window.addEventListener(SHOW_THINKING_CHANGE_EVENT, onChange);
    return () =>
      window.removeEventListener(SHOW_THINKING_CHANGE_EVENT, onChange);
  }, []);
  return value;
}
