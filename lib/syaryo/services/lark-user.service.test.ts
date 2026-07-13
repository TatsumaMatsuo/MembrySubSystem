/**
 * getCurrentLarkUser 単体テスト
 *
 * Lark `authen/v1/user_info` を fetch でモックし、
 * 正常マッピング / API エラー / HTTP エラー / 空トークン / 例外 の各分岐を検証する。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getCurrentLarkUser } from "./lark-user.service";

const ENDPOINT = "https://open.larksuite.com/open-apis/authen/v1/user_info";

function mockFetchOnce(impl: () => Partial<Response> & { json?: () => Promise<unknown> }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => impl() as Response)
  );
}

describe("getCurrentLarkUser", () => {
  beforeEach(() => {
    // ドメインを既定に固定
    delete process.env.LARK_DOMAIN;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("空トークンなら fetch せず null", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await getCurrentLarkUser("")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("正常レスポンスを LarkUser にマッピング", async () => {
    mockFetchOnce(() => ({
      ok: true,
      status: 200,
      json: async () => ({
        code: 0,
        data: {
          open_id: "ou_123",
          union_id: "on_456",
          user_id: "u_789",
          name: "山口太郎",
          en_name: "Taro Yamaguchi",
          email: "",
          enterprise_email: "taro@yamaguchi-kk.co.jp",
          mobile: "+819000000000",
          avatar_url: "https://cdn/origin.png",
          avatar_thumb: "https://cdn/72.png",
          avatar_middle: "https://cdn/240.png",
          avatar_big: "https://cdn/640.png",
        },
      }),
    }));

    const user = await getCurrentLarkUser("valid-token");
    expect(user).toEqual({
      open_id: "ou_123",
      union_id: "on_456",
      user_id: "u_789",
      name: "山口太郎",
      en_name: "Taro Yamaguchi",
      // email 空 → enterprise_email フォールバック
      email: "taro@yamaguchi-kk.co.jp",
      mobile: "+819000000000",
      avatar: {
        avatar_72: "https://cdn/72.png",
        avatar_240: "https://cdn/240.png",
        avatar_640: "https://cdn/640.png",
        avatar_origin: "https://cdn/origin.png",
      },
      department_ids: undefined,
    });
  });

  it("Bearer ヘッダと既定ドメインで呼び出す", async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ code: 0, data: { open_id: "ou_1", name: "n", email: "e@x" } }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchSpy);

    await getCurrentLarkUser("tok-abc");
    expect(fetchSpy).toHaveBeenCalledWith(ENDPOINT, {
      headers: { Authorization: "Bearer tok-abc" },
    });
  });

  it("LARK_DOMAIN env を尊重", async () => {
    process.env.LARK_DOMAIN = "https://open.feishu.cn";
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ code: 0, data: { open_id: "ou_1", name: "n", email: "e@x" } }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchSpy);

    await getCurrentLarkUser("tok");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://open.feishu.cn/open-apis/authen/v1/user_info",
      expect.anything()
    );
  });

  it("アバター無しなら avatar は undefined", async () => {
    mockFetchOnce(() => ({
      ok: true,
      status: 200,
      json: async () => ({ code: 0, data: { open_id: "ou_1", name: "n", email: "e@x" } }),
    }));
    const user = await getCurrentLarkUser("tok");
    expect(user?.avatar).toBeUndefined();
  });

  it("HTTP 401 なら null", async () => {
    mockFetchOnce(() => ({ ok: false, status: 401, json: async () => ({}) }));
    expect(await getCurrentLarkUser("expired")).toBeNull();
  });

  it("API code 非0 なら null", async () => {
    mockFetchOnce(() => ({
      ok: true,
      status: 200,
      json: async () => ({ code: 99991663, msg: "token invalid" }),
    }));
    expect(await getCurrentLarkUser("bad")).toBeNull();
  });

  it("fetch 例外なら null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );
    expect(await getCurrentLarkUser("tok")).toBeNull();
  });
});
