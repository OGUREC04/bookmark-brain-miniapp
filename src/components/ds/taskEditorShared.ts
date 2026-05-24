/* Общие константы и стили редактора task-list (TaskListEditor / TaskRow / AddRow). */
import type { CSSProperties } from "react";

export const MAX_TASK_LEN = 280;

/** Инлайн-инпут редактирования/добавления пункта (белый фон + hairline + видимое выделение). */
export const EDIT_INPUT_STYLE: CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontSize: 14.5,
  lineHeight: 1.4,
  fontFamily: "inherit",
  color: "var(--fg-1)",
  background: "var(--bg-surface-elev)",
  border: "1px solid var(--border-2)",
  borderRadius: 6,
  padding: "1px 6px",
  margin: "-2px -7px",
  outline: "none",
};
