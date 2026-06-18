/** Tests for isWorkingStatus (тикет ti0): поллинг должен ловить "transcribing"/"extracting",
 *  иначе голосовая заметка зависнет в «Brain слушает…». */
import { describe, it, expect } from "vitest";
import { isWorkingStatus } from "../adapters";

describe("isWorkingStatus", () => {
  it("true for transcribing (старт голосовой заметки)", () => {
    expect(isWorkingStatus("transcribing")).toBe(true);
  });
  it("true for extracting (старт документа)", () => {
    expect(isWorkingStatus("extracting")).toBe(true);
  });
  it("true for pending и processing (общий pipeline)", () => {
    expect(isWorkingStatus("pending")).toBe(true);
    expect(isWorkingStatus("processing")).toBe(true);
  });
  it("false for terminal statuses", () => {
    expect(isWorkingStatus("completed")).toBe(false);
    expect(isWorkingStatus("partial")).toBe(false);
    expect(isWorkingStatus("failed")).toBe(false);
    expect(isWorkingStatus("completed_no_embedding")).toBe(false);
  });
  it("false for unknown/empty", () => {
    expect(isWorkingStatus("")).toBe(false);
    expect(isWorkingStatus("whatever")).toBe(false);
  });
});
