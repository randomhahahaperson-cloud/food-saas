declare namespace Cloudflare {
  interface GlobalProps {
    mainModule: typeof import("../src/worker/index");
  }
  interface Env {
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}
