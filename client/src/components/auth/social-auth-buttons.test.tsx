import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  SocialAuthButtons,
  startSocialAuth,
} from "./social-auth-buttons";

describe("SocialAuthButtons", () => {
  it("renders Google provider button", () => {
    render(<SocialAuthButtons />);
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
  });

  it("builds Google start route", () => {
    const navigate = vi.fn();
    startSocialAuth(navigate);
    expect(navigate).toHaveBeenCalledWith("/api/auth/google/start");
  });

  it("builds Google start route with redirect", () => {
    const navigate = vi.fn();
    startSocialAuth(navigate, "/join/invite-token");
    expect(navigate).toHaveBeenCalledWith("/api/auth/google/start?redirect=%2Fjoin%2Finvite-token");
  });
});
