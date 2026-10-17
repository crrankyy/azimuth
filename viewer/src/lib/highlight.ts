/** A small offline tokenizer for code blocks. Classes match azimuth.css: k t s c n f. */

export interface Token {
  text: string;
  cls?: "k" | "t" | "s" | "c" | "n" | "f";
}

const KEYWORDS: Record<string, string[]> = {
  ts: "abstract as async await break case catch class const continue declare default delete do else enum export extends false finally for from function get if implements import in infer instanceof interface is keyof let namespace new null of private protected public readonly return satisfies set static super switch this throw true try type typeof undefined unique var void while with yield".split(
    " ",
  ),
  python:
    "and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield".split(
      " ",
    ),
  rust: "as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while".split(
    " ",
  ),
  go: "break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var nil true false".split(
    " ",
  ),
  sql: "select from where insert into values update set delete create table index primary key not null references and or on join left right inner outer group by order having limit as default unique integer text real blob".split(
    " ",
  ),
  bash: "if then else elif fi for while do done case esac function in return export local".split(
    " ",
  ),
  yaml: "true false null".split(" "),
};

const ALIASES: Record<string, string> = {
  typescript: "ts",
  tsx: "ts",
  javascript: "ts",
  js: "ts",
  jsx: "ts",
  py: "python",
  rs: "rust",
  golang: "go",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  yml: "yaml",
  json: "yaml",
};

function lineComment(lang: string): string[] {
  if (lang === "python" || lang === "bash" || lang === "yaml") return ["#"];
  if (lang === "sql") return ["--"];
  return ["//"];
}

export function tokenize(code: string, language = ""): Token[] {
  const lang = ALIASES[language.toLowerCase()] ?? language.toLowerCase();
  const keywords = new Set(KEYWORDS[lang] ?? KEYWORDS.ts);
  const comments = lineComment(lang);
  const out: Token[] = [];
  let i = 0;
  let plain = "";
  const flush = () => {
    if (plain) out.push({ text: plain });
    plain = "";
  };
  const push = (text: string, cls: Token["cls"]) => {
    flush();
    out.push({ text, cls });
  };
  while (i < code.length) {
    const rest = code.slice(i);
    const comment = comments.find((c) => rest.startsWith(c));
    if (comment) {
      const end = rest.indexOf("\n");
      const text = end === -1 ? rest : rest.slice(0, end);
      push(text, "c");
      i += text.length;
      continue;
    }
    if (rest.startsWith("/*")) {
      const end = rest.indexOf("*/");
      const text = end === -1 ? rest : rest.slice(0, end + 2);
      push(text, "c");
      i += text.length;
      continue;
    }
    const quote = rest[0];
    if (quote === '"' || quote === "'" || quote === "`") {
      let j = 1;
      while (j < rest.length && rest[j] !== quote && rest[j] !== "\n")
        j += rest[j] === "\\" ? 2 : 1;
      const text = rest.slice(0, j + 1);
      push(text, "s");
      i += text.length;
      continue;
    }
    const number = /^\d[\d_]*(\.\d+)?/.exec(rest);
    if (number && !/[\w$]/.test(code[i - 1] ?? "")) {
      push(number[0], "n");
      i += number[0].length;
      continue;
    }
    const word = /^[A-Za-z_$][\w$]*/.exec(rest);
    if (word) {
      const w = word[0];
      const next = rest.slice(w.length).match(/^\s*\(/);
      if (keywords.has(lang === "sql" ? w.toLowerCase() : w)) push(w, "k");
      else if (next) push(w, "f");
      else if (/^[A-Z][A-Za-z0-9]*$/.test(w) && lang !== "sql" && lang !== "yaml") push(w, "t");
      else plain += w;
      i += w.length;
      continue;
    }
    plain += code[i];
    i++;
  }
  flush();
  return out;
}

/** Line classes for test/run output: failures red, passes green, file pointers dimmed. */
export function outputLineClass(line: string): "fail" | "pass" | "dim" | null {
  if (/\b(FAIL|FAILED|failed|Error|ERROR)\b|✗|×|✖/.test(line)) return "fail";
  if (/❯|^\s+at\s/.test(line)) return "dim";
  if (/\b(PASS|passed)\b|✓/.test(line)) return "pass";
  return null;
}
