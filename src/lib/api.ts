import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { LifecycleError } from "@/domain/tournament-lifecycle";

export function apiData<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function apiProblem(status: number, code: string, title: string, detail: string, requestId?: string) {
  return NextResponse.json({
    type: `https://efightersarena.com/problems/${code.toLowerCase().replaceAll("_", "-")}`,
    title,
    status,
    code,
    detail,
    requestId: requestId ?? crypto.randomUUID(),
  }, { status, headers: { "content-type": "application/problem+json" } });
}

export function invalidInput(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({
      type: "https://efightersarena.com/problems/validation-error",
      title: "Validation failed",
      status: 422,
      code: "VALIDATION_ERROR",
      detail: "One or more request values are invalid.",
      errors: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      requestId: crypto.randomUUID(),
    }, { status: 422, headers: { "content-type": "application/problem+json" } });
  }
  if (error instanceof LifecycleError) {
    return apiProblem(error.status, error.code, error.status === 404 ? "Not found" : "Competition lifecycle conflict", error.message);
  }
  return apiProblem(500, "INTERNAL_ERROR", "Internal server error", "The request could not be completed.");
}

export function normalizePhone(value: string) {
  const compact = value.replace(/[\s()-]/g, "");
  if (/^03\d{9}$/.test(compact)) return `+92${compact.slice(1)}`;
  if (/^92\d{10}$/.test(compact)) return `+${compact}`;
  if (/^\+\d{10,15}$/.test(compact)) return compact;
  throw new Error("Enter a valid international phone number.");
}
