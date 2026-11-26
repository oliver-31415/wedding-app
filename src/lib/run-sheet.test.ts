import { describe, expect, it } from "vitest";
import {
  countUnassigned,
  describeJobCount,
  firstName,
  formatJobTime,
  groupHelperJobs,
  groupJobsByItem,
  HELPER_TOKEN_RE,
  helperLabel,
  newHelperToken,
  parseJobTimes,
  parseTime,
  sortJobs,
} from "./run-sheet";

describe("parseTime", () => {
  it("accepts HH:mm and normalises", () => {
    expect(parseTime("14:30")).toBe("14:30");
    expect(parseTime("9:05")).toBe("09:05");
    expect(parseTime(" 09:05:00 ")).toBe("09:05");
  });
  it("rejects anything else", () => {
    for (const bad of ["", "24:00", "12:60", "2pm", "12", null, undefined]) expect(parseTime(bad)).toBeNull();
  });
});

describe("parseJobTimes", () => {
  it("allows no times, a start only, or a start and end", () => {
    expect(parseJobTimes("", "")).toEqual({ ok: true, startTime: null, endTime: null });
    expect(parseJobTimes("14:30", null)).toEqual({ ok: true, startTime: "14:30", endTime: null });
    expect(parseJobTimes("14:30", "15:00")).toEqual({ ok: true, startTime: "14:30", endTime: "15:00" });
  });
  it("needs the end after the start", () => {
    expect(parseJobTimes("15:00", "15:00")).toEqual({ ok: false, errors: { endTime: "The end time must be after the start time." } });
    expect(parseJobTimes("15:00", "14:00").ok).toBe(false);
  });
  it("needs a start before an end", () => {
    expect(parseJobTimes("", "15:00")).toEqual({ ok: false, errors: { endTime: "Add a start time, or clear the end time." } });
  });
  it("flags bad times", () => {
    expect(parseJobTimes("25:00", "nope")).toEqual({
      ok: false,
      errors: { startTime: "Enter a time like 2:30 pm.", endTime: "Enter a time like 3:00 pm." },
    });
  });
});

describe("sortJobs", () => {
  it("orders by start time, then untimed jobs by position", () => {
    const jobs = [
      { id: "a", startTime: null, endTime: null, position: 1 },
      { id: "b", startTime: "15:00", endTime: null, position: 0 },
      { id: "c", startTime: null, endTime: null, position: 0 },
      { id: "d", startTime: "09:30", endTime: "10:00", position: 3 },
      { id: "e", startTime: "09:30", endTime: "09:45", position: 4 },
    ];
    expect(sortJobs(jobs).map((j) => j.id)).toEqual(["e", "d", "b", "c", "a"]);
    expect(jobs[0].id).toBe("a"); // not mutated
  });
});

describe("formatJobTime", () => {
  it("formats en-AU ranges", () => {
    expect(formatJobTime({ startTime: "14:30", endTime: "15:00" })).toBe("2:30 pm – 3:00 pm");
    expect(formatJobTime({ startTime: "09:05", endTime: null })).toBe("9:05 am");
    expect(formatJobTime({ startTime: null, endTime: null })).toBeNull();
  });
});

describe("counts", () => {
  const jobs = [{ id: "j1" }, { id: "j2" }, { id: "j3" }];
  it("counts jobs with nobody on them", () => {
    expect(countUnassigned(jobs, [{ jobId: "j1", helperId: "h1" }, { jobId: "j1", helperId: "h2" }])).toBe(2);
    expect(countUnassigned([], [])).toBe(0);
  });
  it("describes them", () => {
    expect(describeJobCount(4, 1)).toBe("4 jobs · 1 with no one yet");
    expect(describeJobCount(1, 0)).toBe("1 job");
    expect(describeJobCount(0, 0)).toBeNull();
  });
});

describe("grouping", () => {
  const at = (n: number) => new Date(2027, 0, 1, 0, 0, n);
  // Given out of order: the run sheet sorts by time, untimed last.
  const items = [
    { id: "dance", time: "21:00", createdAt: at(1) },
    { id: "ceremony", time: "15:00", createdAt: at(2) },
    { id: "cleanup", time: null, createdAt: at(0) },
    { id: "doors", time: "18:00", createdAt: at(3) },
  ];
  const jobs = [
    { id: "speech", runSheetItemId: "doors", startTime: "19:00", endTime: null, position: 0 },
    { id: "rings", runSheetItemId: "ceremony", startTime: "15:00", endTime: null, position: 1 },
    { id: "signs", runSheetItemId: "ceremony", startTime: "13:00", endTime: "13:30", position: 0 },
    { id: "packdown", runSheetItemId: "cleanup", startTime: null, endTime: null, position: 0 },
    { id: "gifts", runSheetItemId: "doors", startTime: null, endTime: null, position: 1 },
  ];
  const assignments = [
    { jobId: "speech", helperId: "jess" },
    { jobId: "rings", helperId: "jess" },
    { jobId: "signs", helperId: "jess" },
    { jobId: "packdown", helperId: "jess" },
    { jobId: "gifts", helperId: "tom" },
  ];
  it("groups a helper's jobs by run sheet item, in run sheet order", () => {
    const groups = groupHelperJobs("jess", items, jobs, assignments);
    expect(groups.map((g) => [g.item.id, g.jobs.map((j) => j.id)])).toEqual([
      ["ceremony", ["signs", "rings"]],
      ["doors", ["speech"]],
      ["cleanup", ["packdown"]],
    ]);
    expect(groupHelperJobs("nobody", items, jobs, assignments)).toEqual([]);
  });
  it("keeps every item for the full run sheet, untimed jobs last", () => {
    const groups = groupJobsByItem(items, jobs);
    expect(groups.map((g) => [g.item.id, g.jobs.map((j) => j.id)])).toEqual([
      ["ceremony", ["signs", "rings"]],
      ["doors", ["speech", "gifts"]],
      ["dance", []],
      ["cleanup", ["packdown"]],
    ]);
  });
});

describe("names and tokens", () => {
  it("labels helpers", () => {
    expect(helperLabel({ name: "Jess Lee", role: "Bridesmaid" })).toBe("Jess Lee (Bridesmaid)");
    expect(helperLabel({ name: "Tom", role: null })).toBe("Tom");
    expect(firstName("  Jess  Lee ")).toBe("Jess");
  });
  it("makes random URL-safe tokens", () => {
    const a = newHelperToken();
    expect(a).toMatch(HELPER_TOKEN_RE);
    expect(a).toHaveLength(32);
    expect(newHelperToken()).not.toBe(a);
  });
});
