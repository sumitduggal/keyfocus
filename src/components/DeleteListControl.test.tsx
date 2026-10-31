// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteListControl } from "./DeleteListControl";

afterEach(cleanup);

it("requires confirmation and allows cancellation before deleting", async () => {
  const user = userEvent.setup();
  const onDelete = vi.fn();
  render(<DeleteListControl label="Delete list" dialogLabel="Confirm delete list" description="Delete this list?" onDelete={onDelete} />);

  await user.click(screen.getByRole("button", { name: "Delete list" }));
  expect(screen.getByRole("alertdialog", { name: "Confirm delete list" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onDelete).not.toHaveBeenCalled();
  expect(screen.queryByRole("alertdialog")).toBeNull();

  await user.click(screen.getByRole("button", { name: "Delete list" }));
  await user.click(screen.getByRole("button", { name: "Delete list" }));
  expect(onDelete).toHaveBeenCalledOnce();
});
