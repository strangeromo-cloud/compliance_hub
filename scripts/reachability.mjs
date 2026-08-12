// What a deployment can actually reach, source by source.
//
// The hosted server's network is not this laptop's. Hong Kong cannot route to
// MOFCOM's 211.88.32.x at all, cannot resolve sanctionslist.fcdo.gov.uk, and
// times out to OFAC — none of which is visible from here, and none of which is a
// code fault. Finding it meant pulling /api/data-sources by hand and reading
// error strings, which is the sort of thing that gets done once and then not
// again.
//
//   npm run reachability                              the deployed host
//   npm run reachability -- http://127.0.0.1:8787     any other
//
// It reads the deployment's own coverage endpoint rather than making the
// requests itself: the question is what that host can reach, and only that host
// can answer it. Exits non-zero when a screening list is missing outright, so it
// can gate a deploy.

const HOST = (process.argv[2] || "https://compliance-hub.zeabur.app").replace(/\/$/, "");

// Why a source is unreachable, from the error the host recorded. Node collapses
// every transport failure into "fetch failed", so the cause chain is the only
// place the distinction survives — and the distinction is the whole point: a
// route that does not exist is a different problem from a name that will not
// resolve, and neither is fixed by retrying.
const CAUSES = [
  [/ENETUNREACH/, "网络不可达 · 没有到该地址的路由"],
  [/EAI_AGAIN|ENOTFOUND/, "DNS 解析失败"],
  [/ETIMEDOUT|timed out/i, "连接超时"],
  [/ECONNREFUSED/, "连接被拒绝"],
  [/certificate|TLS|SSL/i, "TLS 握手失败"],
  [/40[13]|Forbidden|Unauthorized/, "被拒绝 · 需要凭证"],
  [/429/, "被限流"]
];
const cause = (error) => CAUSES.find(([pattern]) => pattern.test(String(error)))?.[1] || null;

const host = (source) => { try { return new URL(source.sync?.url || source.url || "").host; } catch { return ""; } };

const response = await fetch(`${HOST}/api/data-sources`, { signal: AbortSignal.timeout(45_000) })
  .catch((error) => { console.error(`${HOST} 取不到覆盖数据：${error.message}`); process.exit(2); });
if (!response.ok) { console.error(`${HOST} 返回 HTTP ${response.status}`); process.exit(2); }
const { sources } = await response.json();

const state = (source) => source.sync?.status || "not_synced";

// Every type a name is screened against, not one of them.
//
// Two wrong answers got here before this one, and both printed all-clear. The
// first keyed on usedForSteps, which the coverage payload does not carry, so
// nothing matched and the section reported zero sources as a pass. The second
// keyed on restricted_party_list alone — six sources, 44,933 records, and a
// clean bill of health on a host where OFAC's SDN list and the UK list held
// nothing at all, because those carry sanctions_list and ownership_graph.
//
// A check whose scope is narrower than the thing it certifies is worse than no
// check: it turns a gap into a green tick.
const SCREENED_TYPES = new Set([
  "restricted_party_list", "sanctions_list", "restricted_party_notice", "ownership_graph"
]);
const isScreening = (source) => SCREENED_TYPES.has(source.sourceType);

console.log(`${HOST}\n`);

const buckets = new Map();
for (const source of sources) buckets.set(state(source), (buckets.get(state(source)) || 0) + 1);
console.log(`${sources.length} 个源：${[...buckets].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} ${k}`).join(" · ")}\n`);

// Grouped by cause rather than by source, because the fix is per cause: one
// route, one resolver, one key. Listing them source by source made five symptoms
// of one missing route read as five problems.
const failing = sources.filter((source) => source.sync?.error);
if (failing.length) {
  const groups = new Map();
  for (const source of failing) {
    const key = `${cause(source.sync.error) || "其他"}  ${host(source) || ""}`.trim();
    (groups.get(key) || groups.set(key, []).get(key)).push(source);
  }
  console.log("取数失败，按原因分组：");
  for (const [key, group] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n  ${key}`);
    for (const source of group) {
      const covered = state(source) === "fallback_snapshot";
      console.log(`    ${source.sourceId.padEnd(28)} ${covered ? `有时点副本 ${String(source.sync.bundledAt || "").slice(0, 10)}` : "无副本"}`);
    }
  }
  console.log("");
}

// The number that decides whether this host may be relied on. A screening list
// with no records is not a degraded source: it is a name that will never match,
// which reads on screen exactly like a name that is clean.
const screening = sources.filter(isScreening);
const empty = screening.filter((source) => !(source.sync?.recordCount > 0));
const live = screening.filter((source) => state(source) === "success");
const copies = screening.filter((source) => state(source) === "fallback_snapshot");
const sum = (list) => list.reduce((total, source) => total + (source.sync?.recordCount || 0), 0);

console.log("筛查名单：");
console.log(`  实时     ${String(sum(live).toLocaleString()).padStart(9)} 条  ${live.length} 个源`);
console.log(`  时点副本 ${String(sum(copies).toLocaleString()).padStart(9)} 条  ${copies.length} 个源`);
if (empty.length) {
  console.log(`\n  一条记录都没有的名单源（筛查不覆盖它们）：`);
  for (const source of empty) console.log(`    ${source.sourceId.padEnd(28)} ${state(source)}`);
}

if (!screening.length) {
  console.error("\n没有识别出任何筛查名单源 —— 覆盖数据的字段可能变了，本次检查什么也没验证。");
  process.exit(2);
}
console.log(empty.length
  ? `\n${empty.length} 个筛查名单在这台主机上是空的。`
  : "\n每个筛查名单都有记录，实时或副本。");
process.exit(empty.length ? 1 : 0);
