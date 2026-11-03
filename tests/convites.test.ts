import { describe, expect, it } from "vitest";
import { withInvites, type InviteRow } from "@/lib/convites";

const invite = (token: string, updated_at: string): InviteRow => ({ token, title: "Vídeo", duration_s: 30, stage: "gravar", published_at: null, updated_at });

describe("convites na lista de vídeos", () => {
  it("mistura vídeos e convites pelo que mexeu por último", () => {
    const list = withInvites([{ id: "a", updated_at: "2026-11-01T10:00:00Z" }, { id: "b", updated_at: "2026-11-03T10:00:00Z" }], [invite("c", "2026-11-02T10:00:00Z")]);
    expect(list.map((i) => (i.kind === "video" ? i.row.id : i.row.token))).toEqual(["b", "c", "a"]);
    expect(list[1].kind).toBe("invite");
  });

  it("funciona sem convites e sem vídeos", () => {
    expect(withInvites([], [])).toEqual([]);
    expect(withInvites([{ updated_at: "2026-11-01T10:00:00Z" }], [])).toHaveLength(1);
    expect(withInvites([], [invite("c", "2026-11-02T10:00:00Z")])[0].kind).toBe("invite");
  });
});
