import os from "node:os";
import path from "node:path";
import fs from "node:fs";

import { describe, expect, it } from "vitest";

import { AppServerBridgeService } from "../src/appServer/AppServerBridgeService.js";
import type {
  AppServerClient,
  AppServerNotification
} from "../src/appServer/AppServerClient.js";
import type { BridgeConfig } from "../src/config.js";
import { UploadService } from "../src/uploads/UploadService.js";
import { WorkspaceService } from "../src/workspaces/WorkspaceService.js";

describe("AppServerBridgeService thread actions", () => {
  it("renames and archives threads through app-server RPC methods", async () => {
    const client = new CapturingAppServerClient();
    const config = testConfig();
    const service = new AppServerBridgeService({
      config,
      client: client as unknown as AppServerClient,
      workspaceService: new WorkspaceService(config),
      uploadService: new UploadService({ uploadDir: config.uploadDir, maxBytes: config.uploadMaxBytes })
    });

    const renamed = (await service.renameThread("thr_1", { title: "Mobile title" })) as {
      title: string;
    };
    await service.archiveThread("thr_1", { archived: true });
    await service.archiveThread("thr_1", { archived: false });

    expect(renamed.title).toBe("Mobile title");
    expect(client.requests.map((request) => request.method)).toEqual([
      "thread/name/set",
      "thread/read",
      "thread/archive",
      "thread/unarchive"
    ]);
    expect(client.requests[0]?.params).toEqual({
      threadId: "thr_1",
      name: "Mobile title"
    });
  });

  it("lists, reloads, and reads MCP resources through app-server RPC methods", async () => {
    const client = new CapturingAppServerClient();
    const config = testConfig();
    const service = new AppServerBridgeService({
      config,
      client: client as unknown as AppServerClient,
      workspaceService: new WorkspaceService(config),
      uploadService: new UploadService({ uploadDir: config.uploadDir, maxBytes: config.uploadMaxBytes })
    });

    await service.listMcpServers({ detail: "full", limit: 10, cursor: "cursor_1" });
    await service.readMcpResource({ server: "github", uri: "repo://openai/codex", threadId: "thr_1" });
    await service.reloadMcpServers();

    expect(client.requests.slice(-3)).toEqual([
      {
        method: "mcpServerStatus/list",
        params: { detail: "full", limit: 10, cursor: "cursor_1" }
      },
      {
        method: "mcpServer/resource/read",
        params: { server: "github", uri: "repo://openai/codex", threadId: "thr_1" }
      },
      {
        method: "config/mcpServer/reload",
        params: undefined
      }
    ]);
  });

  it("lists apps and skills through app-server RPC methods", async () => {
    const client = new CapturingAppServerClient();
    const config = testConfig();
    const service = new AppServerBridgeService({
      config,
      client: client as unknown as AppServerClient,
      workspaceService: new WorkspaceService(config),
      uploadService: new UploadService({ uploadDir: config.uploadDir, maxBytes: config.uploadMaxBytes })
    });

    await service.listApps({ limit: 20, cursor: "apps_cursor", threadId: "thr_1", forceRefetch: true });
    await service.listSkills({ cwd: process.cwd(), forceReload: true });

    expect(client.requests.slice(-2)).toEqual([
      {
        method: "app/list",
        params: { limit: 20, cursor: "apps_cursor", threadId: "thr_1", forceRefetch: true }
      },
      {
        method: "skills/list",
        params: { cwds: [process.cwd()], forceReload: true }
      }
    ]);
  });
});

describe("AppServerBridgeService attachments", () => {
  it("sends images as localImage items and other files as text references", async () => {
    const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-upload-"));
    const config = testConfig(uploadDir);
    const uploadService = new UploadService({ uploadDir, maxBytes: config.uploadMaxBytes });
    const image = uploadService.save({
      name: "screenshot.png",
      mimeType: "image/png",
      dataBase64: Buffer.from("fake-png").toString("base64")
    });
    const notes = uploadService.save({
      name: "notes.txt",
      mimeType: "text/plain",
      dataBase64: Buffer.from("hello attachment").toString("base64")
    });
    const client = new CapturingAppServerClient();
    const service = createService(config, client, uploadService);

    await collect(
      service.runThread(
        "thr_1",
        {
          message: "Review these attachments",
          cwd: process.cwd(),
          input_items: [
            { type: "attachment", name: image.name, path: image.path },
            { type: "attachment", name: notes.name, path: notes.path }
          ]
        },
        new AbortController().signal
      )
    );

    expect(turnStartInput(client)).toEqual([
      { type: "text", text: "Review these attachments" },
      { type: "localImage", path: image.path },
      { type: "text", text: `Attached image: ${image.name} (${image.path})` },
      { type: "text", text: `Attached file: ${notes.name} (${notes.path})` }
    ]);
  });

  it("rejects attachment paths outside the upload directory", async () => {
    const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-upload-"));
    const config = testConfig(uploadDir);
    const uploadService = new UploadService({ uploadDir, maxBytes: config.uploadMaxBytes });
    const client = new CapturingAppServerClient();
    const service = createService(config, client, uploadService);

    await expect(
      collect(
        service.runThread(
          "thr_1",
          {
            message: "Read this",
            cwd: process.cwd(),
            input_items: [{ type: "attachment", name: "passwd", path: "/etc/passwd" }]
          },
          new AbortController().signal
        )
      )
    ).rejects.toThrow("outside the upload directory");
  });
});

function createService(
  config: BridgeConfig,
  client: CapturingAppServerClient,
  uploadService: UploadService
) {
  return new AppServerBridgeService({
    config,
    client: client as unknown as AppServerClient,
    workspaceService: new WorkspaceService(config),
    uploadService
  });
}

async function collect(events: AsyncGenerator<unknown>) {
  const collected: unknown[] = [];
  for await (const event of events) {
    collected.push(event);
  }
  return collected;
}

function turnStartInput(client: CapturingAppServerClient) {
  const request = client.requests.find((entry) => entry.method === "turn/start");
  return (request?.params as { input?: unknown } | undefined)?.input;
}

class CapturingAppServerClient {
  readonly requests: Array<{ method: string; params: unknown }> = [];
  private readonly notificationListeners = new Set<(message: AppServerNotification) => void>();

  onNotification(listener: (message: AppServerNotification) => void) {
    this.notificationListeners.add(listener);
    return () => {
      this.notificationListeners.delete(listener);
    };
  }

  onServerRequest() {
    return () => {};
  }

  async request(method: string, params?: unknown) {
    this.requests.push({ method, params });
    if (method === "turn/start") {
      this.notify({ method: "turn/completed", params: { turn: { id: "turn_1", status: "completed" } } });
      return { turn: { id: "turn_1", status: "inProgress" } };
    }
    if (method === "thread/read" || method === "thread/unarchive") {
      return {
        thread: {
          id: "thr_1",
          sessionId: "thr_1",
          preview: "",
          name: "Mobile title",
          cwd: process.cwd(),
          createdAt: 1,
          updatedAt: 1,
          status: { type: "idle" },
          path: null,
          modelProvider: "openai",
          source: "appServer",
          turns: []
        }
      };
    }
    if (method === "mcpServerStatus/list") {
      return { data: [], nextCursor: null };
    }
    if (method === "mcpServer/resource/read") {
      return { contents: [{ uri: "repo://openai/codex", text: "resource body" }] };
    }
    if (method === "app/list") {
      return { data: [], nextCursor: null };
    }
    if (method === "skills/list") {
      return { data: [] };
    }
    return {};
  }

  private notify(message: AppServerNotification) {
    for (const listener of this.notificationListeners) {
      listener(message);
    }
  }
}

function testConfig(uploadDir = path.join(os.tmpdir(), "codex-mobile-test-uploads")): BridgeConfig {
  return {
    host: "127.0.0.1",
    port: 8787,
    runtime: "app-server",
    workspaceAllowlist: [process.cwd()],
    workspaceAllowlistFile: "__missing_allowlist__",
    uploadDir,
    uploadMaxBytes: 1024 * 1024,
    runBufferEvents: 5000,
    runRetentionMs: 300_000,
    defaultWorkspace: process.cwd(),
    defaultSkipGitRepoCheck: true,
    defaultModel: null,
    heartbeatMs: 15000,
    version: "test"
  };
}
