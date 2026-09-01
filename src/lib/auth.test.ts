import { describe, expect, it } from "vitest";
import { isAdminRole } from "./auth";

describe("admin role authorization", () => {
  it.each(["super_admin", "admin"])("allows %s", (role) => {
    expect(isAdminRole(role)).toBe(true);
  });

  it.each(["gamer", "tournament_operator", "content_manager", undefined])("denies %s", (role) => {
    expect(isAdminRole(role)).toBe(false);
  });
});
