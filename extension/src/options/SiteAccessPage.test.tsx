import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SiteAccessPage } from "./SiteAccessPage";

const GRANTED_MESSAGE =
  "FlytLese can read pages. Reload the page you were reading.";

beforeEach(() => {
  vi.spyOn(chrome.permissions, "contains").mockImplementation(
    async () => false,
  );
});

afterEach(() => vi.restoreAllMocks());

async function findAllowButton() {
  const button = screen.getByRole("button", {
    name: "Allow access to websites",
  });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
}

describe("SiteAccessPage", () => {
  it("test_site_access_given_missing_permission_expect_explanation_and_user_gesture_required", async () => {
    render(<SiteAccessPage />);

    await findAllowButton();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Website access",
    );
    expect(
      screen.getByText(/look up words, translate selections, and import pages/),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "What is sent to Flyt" }),
    ).toBeVisible();
    expect(
      screen.getByText(/dictionary searches and selected text/),
    ).toBeVisible();
    expect(screen.getByText(/session token/)).toBeVisible();
    expect(chrome.permissions.request).not.toHaveBeenCalled();
  });

  it("test_site_access_given_allow_click_expect_website_and_api_request_before_async_work", async () => {
    render(<SiteAccessPage />);

    fireEvent.click(await findAllowButton());

    expect(chrome.permissions.request).toHaveBeenCalledWith({
      origins: ["<all_urls>", "http://localhost:8000/*"],
    });
    expect(await screen.findByText(GRANTED_MESSAGE)).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("test_site_access_given_existing_permission_expect_reload_guidance_without_request", async () => {
    vi.spyOn(chrome.permissions, "contains").mockImplementation(
      async () => true,
    );

    render(<SiteAccessPage />);

    expect(await screen.findByText(GRANTED_MESSAGE)).toBeVisible();
    expect(chrome.permissions.contains).toHaveBeenCalledWith({
      origins: ["<all_urls>", "http://localhost:8000/*"],
    });
    expect(chrome.permissions.request).not.toHaveBeenCalled();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("test_site_access_given_pending_request_expect_disabled_button_and_status", async () => {
    vi.spyOn(chrome.permissions, "request").mockImplementation(
      () => new Promise<boolean>(() => {}),
    );
    render(<SiteAccessPage />);
    const button = await findAllowButton();

    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Waiting for permission",
    );
  });

  it("test_site_access_given_denied_request_expect_retry_without_granted_message", async () => {
    vi.spyOn(chrome.permissions, "request").mockImplementationOnce(
      async () => false,
    );
    render(<SiteAccessPage />);

    fireEvent.click(await findAllowButton());

    expect(
      await screen.findByText(/Website access was not allowed/),
    ).toBeVisible();
    expect(screen.queryByText(GRANTED_MESSAGE)).not.toBeInTheDocument();
    fireEvent.click(await findAllowButton());
    expect(await screen.findByText(GRANTED_MESSAGE)).toBeVisible();
  });

  it.each(["contains", "request"] as const)(
    "test_site_access_given_permission_api_failure_expect_retryable_error",
    async (method) => {
      vi.mocked(chrome.permissions[method]).mockRejectedValueOnce(
        new Error("Permission API unavailable"),
      );
      render(<SiteAccessPage />);

      if (method === "request") fireEvent.click(await findAllowButton());

      expect(
        await screen.findByText("Could not confirm website access. Try again."),
      ).toBeVisible();
      expect(await findAllowButton()).toBeEnabled();
      expect(screen.queryByText(GRANTED_MESSAGE)).not.toBeInTheDocument();
    },
  );
});
