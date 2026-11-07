"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventDropArg } from "@fullcalendar/core";
import { rescheduleTargetAction } from "@/lib/actions/content";

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  backgroundColor: string;
  borderColor: string;
  extendedProps: {
    postId: string;
    platform: string;
    status: string;
    account: string;
  };
};

export function ContentCalendar({ slug, events }: { slug: string; events: CalendarEvent[] }) {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar>(null);

  async function handleDrop(info: EventDropArg) {
    if (!info.event.start) return;
    if (!window.confirm("Move this post to the new time?")) {
      info.revert();
      return;
    }
    const data = new FormData();
    data.set("workspaceSlug", slug);
    data.set("targetId", info.event.id);
    data.set("scheduledAt", info.event.start.toISOString());
    try {
      await rescheduleTargetAction(data);
      router.refresh();
    } catch {
      info.revert();
    }
  }

  function handleClick(info: EventClickArg) {
    const postId = info.event.extendedProps.postId as string;
    router.push(`/w/${slug}/content-studio/${postId}`);
  }

  return (
    <div className="content-calendar rounded-xl border border-border bg-card p-3 [--fc-border-color:var(--border)] [--fc-page-bg-color:transparent] [--fc-today-bg-color:color-mix(in_srgb,var(--primary)_8%,transparent)]">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        height="auto"
        editable
        eventDrop={handleDrop}
        eventClick={handleClick}
        dayMaxEvents={3}
        events={events}
        eventTimeFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
        nowIndicator
      />
    </div>
  );
}
