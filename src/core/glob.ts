/** Minimal glob → RegExp for test-file patterns: `**`, `*`, `?` and `{a,b}`. Paths use `/`. */
export function globToRegExp(glob: string): RegExp {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i] as string;
    if (c === "*") {
      if (glob[i + 1] === "*") {
        const slash = glob[i + 2] === "/";
        out += slash ? "(?:.*/)?" : ".*";
        i += slash ? 2 : 1;
      } else {
        out += "[^/]*";
      }
    } else if (c === "?") {
      out += "[^/]";
    } else if (c === "{") {
      const end = glob.indexOf("}", i);
      if (end === -1) {
        out += "\\{";
        continue;
      }
      const options = glob
        .slice(i + 1, end)
        .split(",")
        .map((o) => o.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*"));
      out += `(?:${options.join("|")})`;
      i = end;
    } else {
      out += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${out}$`);
}

export function matchesAny(path: string, globs: RegExp[]): boolean {
  return globs.some((g) => g.test(path));
}

/**
 * Whether a file belongs to one of the architecture's module paths: the path itself, anything
 * under it, or a file named after it, so `src/buffer` covers `src/buffer.rs` as well as
 * `src/buffer/gap.rs` (Rust's file modules, `src/buffer.ts`, `pkg/buffer.py`).
 */
export function inModule(path: string, modulePaths: string[]): boolean {
  const stem = path.replace(/\.[^./]+$/, "");
  return modulePaths.some((m) => path === m || path.startsWith(`${m}/`) || stem === m);
}
