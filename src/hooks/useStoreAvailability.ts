import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StoreAvailability = {
  isOpenNow: boolean;
  closesAt?: string; // HH:mm
  nextOpenAt?: { date: string; time: string }; // YYYY-MM-DD + HH:mm
  reason?: "manual" | "outside_hours";
};

type StoreHourRow = {
  day_of_week: number; // 0=Sun .. 6=Sat
  is_closed: boolean;
  open_time: string | null; // HH:mm:ss
  close_time: string | null; // HH:mm:ss
};

type StoreExceptionRow = {
  exception_date: string; // YYYY-MM-DD
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
  note: string | null;
};

const TZ = "America/Sao_Paulo";

function hhmmFromTime(time: string | null | undefined) {
  if (!time) return undefined;
  // '18:00:00' -> '18:00'
  return time.slice(0, 5);
}

function minutesFromHHMM(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function getZonedParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const date = `${map.year}-${map.month}-${map.day}`;
  const time = `${map.hour}:${map.minute}`;

  // Brazil has no DST; use -03:00 to compute weekday reliably.
  const weekdayIndex = new Date(`${date}T00:00:00-03:00`).getDay();

  return { date, time, weekdayIndex };
}

function addDaysISO(date: string, days: number) {
  const d = new Date(`${date}T00:00:00-03:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getWeekdayIndexFromISO(date: string) {
  return new Date(`${date}T00:00:00-03:00`).getDay();
}

export function useStoreAvailability(manualIsOpen: boolean) {
  const hoursQuery = useQuery({
    queryKey: ["store-hours"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_hours")
        .select("day_of_week,is_closed,open_time,close_time")
        .order("day_of_week");
      if (error) throw error;
      return (data || []) as StoreHourRow[];
    },
  });

  const exceptionsQuery = useQuery({
    queryKey: ["store-exceptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_exceptions")
        .select("exception_date,is_closed,open_time,close_time,note")
        .order("exception_date", { ascending: true });
      if (error) throw error;
      return (data || []) as StoreExceptionRow[];
    },
  });

  const availability: StoreAvailability = useMemo(() => {
    const { date: todayISO, time: nowHHMM } = getZonedParts();
    const nowMinutes = minutesFromHHMM(nowHHMM);

    if (!manualIsOpen) {
      return {
        isOpenNow: false,
        reason: "manual",
        nextOpenAt: findNextOpen({
          todayISO,
          nowMinutes,
          hours: hoursQuery.data || [],
          exceptions: exceptionsQuery.data || [],
        }),
      };
    }

    const todaysRule = resolveScheduleForDate({
      dateISO: todayISO,
      hours: hoursQuery.data || [],
      exceptions: exceptionsQuery.data || [],
    });

    if (!todaysRule || todaysRule.is_closed) {
      return {
        isOpenNow: false,
        reason: "outside_hours",
        nextOpenAt: findNextOpen({
          todayISO,
          nowMinutes,
          hours: hoursQuery.data || [],
          exceptions: exceptionsQuery.data || [],
        }),
      };
    }

    const openHHMM = hhmmFromTime(todaysRule.open_time)!;
    const closeHHMM = hhmmFromTime(todaysRule.close_time)!;
    const openM = minutesFromHHMM(openHHMM);
    const closeM = minutesFromHHMM(closeHHMM);

    const isOpenNow = nowMinutes >= openM && nowMinutes <= closeM;

    return {
      isOpenNow,
      reason: isOpenNow ? undefined : "outside_hours",
      closesAt: closeHHMM,
      nextOpenAt: isOpenNow
        ? undefined
        : findNextOpen({
            todayISO,
            nowMinutes,
            hours: hoursQuery.data || [],
            exceptions: exceptionsQuery.data || [],
          }),
    };
  }, [exceptionsQuery.data, hoursQuery.data, manualIsOpen]);

  return {
    availability,
    isLoading: hoursQuery.isLoading || exceptionsQuery.isLoading,
    error: hoursQuery.error || exceptionsQuery.error,
  };
}

function resolveScheduleForDate(params: {
  dateISO: string;
  hours: StoreHourRow[];
  exceptions: StoreExceptionRow[];
}): { is_closed: boolean; open_time: string | null; close_time: string | null } | null {
  const exception = params.exceptions.find((e) => e.exception_date === params.dateISO);
  if (exception) {
    return {
      is_closed: exception.is_closed,
      open_time: exception.open_time,
      close_time: exception.close_time,
    };
  }

  const dow = getWeekdayIndexFromISO(params.dateISO);
  const rule = params.hours.find((h) => h.day_of_week === dow);
  if (!rule) return null;
  return {
    is_closed: rule.is_closed,
    open_time: rule.open_time,
    close_time: rule.close_time,
  };
}

function findNextOpen(params: {
  todayISO: string;
  nowMinutes: number;
  hours: StoreHourRow[];
  exceptions: StoreExceptionRow[];
}): { date: string; time: string } | undefined {
  // Look ahead up to 14 days
  for (let offset = 0; offset <= 14; offset++) {
    const dateISO = addDaysISO(params.todayISO, offset);
    const rule = resolveScheduleForDate({
      dateISO,
      hours: params.hours,
      exceptions: params.exceptions,
    });

    if (!rule || rule.is_closed) continue;

    const openHHMM = hhmmFromTime(rule.open_time);
    const closeHHMM = hhmmFromTime(rule.close_time);
    if (!openHHMM || !closeHHMM) continue;

    if (offset === 0) {
      const openM = minutesFromHHMM(openHHMM);
      const closeM = minutesFromHHMM(closeHHMM);

      // If still before opening today, next open is today.
      if (params.nowMinutes < openM) return { date: dateISO, time: openHHMM };

      // If already after close, skip to next day.
      if (params.nowMinutes > closeM) continue;

      // Otherwise it's within today's window (shouldn't happen when called from closed), but safe.
      return { date: dateISO, time: openHHMM };
    }

    return { date: dateISO, time: openHHMM };
  }

  return undefined;
}
