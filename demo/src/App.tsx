import { useState, type ComponentType } from "react";

import { ConnectionGateSection } from "./sections/ConnectionGateSection";
import { EventSourceSection } from "./sections/EventSourceSection";
import { HeartbeatSection } from "./sections/HeartbeatSection";
import { OnlineStatusSection } from "./sections/OnlineStatusSection";
import { PageVisibilitySection } from "./sections/PageVisibilitySection";
import { ReconnectSection } from "./sections/ReconnectSection";
import { WebSocketSection } from "./sections/WebSocketSection";

type Tab = {
  id: string;
  label: string;
  Section: ComponentType;
};

const TABS = [
  { Section: WebSocketSection, id: "useWebSocket", label: "useWebSocket" },
  { Section: EventSourceSection, id: "useEventSource", label: "useEventSource" },
  { Section: ReconnectSection, id: "useReconnect", label: "useReconnect" },
  { Section: HeartbeatSection, id: "useHeartbeat", label: "useHeartbeat" },
  {
    Section: OnlineStatusSection,
    id: "useOnlineStatus",
    label: "useOnlineStatus"
  },
  {
    Section: PageVisibilitySection,
    id: "usePageVisibility",
    label: "usePageVisibility"
  },
  {
    Section: ConnectionGateSection,
    id: "useConnectionGate",
    label: "useConnectionGate"
  }
] as const satisfies readonly Tab[];

export const App = () => {
  const [activeTabId, setActiveTabId] = useState<string>(TABS[0].id);
  const activeTab = TABS.find((tab) => tab.id === activeTabId) ?? TABS[0];
  const ActiveSection = activeTab.Section;

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">react-realtime-hooks</p>
        <h1>Realtime hooks playground</h1>
        <p className="lede">
          Each tab below isolates one hook from the library. Pick a tab to
          mount only that hook's demo block — controls, snapshot, and event
          log live next to each other, with no cross-talk between hooks.
        </p>
      </section>

      <nav aria-label="Hook demos" className="tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            aria-controls={`tab-panel-${tab.id}`}
            aria-selected={tab.id === activeTabId}
            className={`tab ${tab.id === activeTabId ? "tab-active" : ""}`}
            id={`tab-${tab.id}`}
            onClick={() => {
              setActiveTabId(tab.id);
            }}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div
        aria-labelledby={`tab-${activeTab.id}`}
        id={`tab-panel-${activeTab.id}`}
        key={activeTab.id}
        role="tabpanel"
      >
        <ActiveSection />
      </div>
    </main>
  );
};
