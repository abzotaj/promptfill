export const styles = /* css */ `
:host { all: initial; }
* { box-sizing: border-box; }

.pf {
  --bg: #15161c;
  --bg-2: #1d1f27;
  --bg-3: #262935;
  --line: #2f3241;
  --text: #e9eaf0;
  --muted: #9a9db0;
  --accent: #8b6dff;
  --accent-2: #a78bff;
  --ok: #3ecf8e;
  --warn: #f5a524;
  --err: #f0616d;
  font: 13px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: var(--text);
  position: fixed;
  z-index: 2147483646;
  bottom: 20px;
  right: 20px;
}
.pf[data-position="bottom-left"] { right: auto; left: 20px; }
.pf[data-theme="light"] {
  --bg: #ffffff; --bg-2: #f6f6f9; --bg-3: #ececf2; --line: #e1e2ea;
  --text: #1b1c22; --muted: #646779;
}

.launcher {
  display: inline-flex; align-items: center; gap: 8px;
  height: 40px; padding: 0 16px 0 12px;
  border: 1px solid var(--line); border-radius: 999px;
  background: var(--bg); color: var(--text);
  font: inherit; font-weight: 600; cursor: pointer;
  box-shadow: 0 8px 24px rgba(0,0,0,.28);
  transition: transform .12s ease, border-color .12s ease;
}
.launcher:hover { transform: translateY(-1px); border-color: var(--accent); }
.launcher .spark { color: var(--accent-2); font-size: 15px; }
.launcher kbd { font: 11px ui-monospace, monospace; color: var(--muted); }

.panel {
  width: min(380px, calc(100vw - 32px));
  max-height: min(640px, calc(100vh - 40px));
  display: flex; flex-direction: column;
  background: var(--bg); border: 1px solid var(--line); border-radius: 14px;
  box-shadow: 0 20px 50px rgba(0,0,0,.4);
  overflow: hidden;
}
.panel[hidden], .launcher[hidden] { display: none; }

.head {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 12px 12px 16px; border-bottom: 1px solid var(--line);
}
.brand { font-weight: 700; letter-spacing: -.01em; }
.brand span { color: var(--muted); font-weight: 500; margin-left: 4px; }
.head .grow { flex: 1; }
.icon-btn {
  width: 28px; height: 28px; display: grid; place-items: center;
  border: 0; border-radius: 8px; background: transparent; color: var(--muted);
  cursor: pointer; font: 15px/1 inherit;
}
.icon-btn:hover { background: var(--bg-3); color: var(--text); }

.body { padding: 14px 16px; overflow: auto; display: grid; gap: 14px; }

.scope {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 10px 12px; border-radius: 10px; background: var(--bg-2);
  border: 1px solid var(--line);
}
.scope b { font-weight: 600; }
.scope small { color: var(--muted); display: block; }
.link { border: 0; background: none; color: var(--accent-2); cursor: pointer; font: inherit; font-weight: 600; padding: 0; }

.label { color: var(--muted); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 6px; }

.presets { display: grid; gap: 6px; }
.preset {
  text-align: left; padding: 9px 12px; border-radius: 10px;
  border: 1px solid var(--line); background: var(--bg-2); color: var(--text);
  font: inherit; cursor: pointer;
}
.preset:hover { border-color: var(--accent); }
.preset b { display: block; font-weight: 600; color: var(--accent-2); }
.preset small { color: var(--muted); }

textarea.prompt {
  width: 100%; min-height: 76px; resize: vertical;
  padding: 10px 12px; border-radius: 10px;
  border: 1px solid var(--line); background: var(--bg-2); color: var(--text);
  font: inherit; outline: none;
}
textarea.prompt:focus { border-color: var(--accent); }

.row { display: flex; gap: 8px; align-items: center; }
.row .grow { flex: 1; }
.hint { color: var(--muted); font-size: 11px; }

.btn {
  height: 34px; padding: 0 14px; border-radius: 9px; border: 1px solid var(--line);
  background: var(--bg-3); color: var(--text); font: inherit; font-weight: 600; cursor: pointer;
}
.btn:hover:not(:disabled) { border-color: var(--accent); }
.btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn.primary:hover:not(:disabled) { background: var(--accent-2); }
.btn:disabled { opacity: .5; cursor: default; }

.preview { display: grid; gap: 4px; }
.item {
  display: grid; grid-template-columns: 18px 1fr; gap: 8px; align-items: start;
  padding: 8px 10px; border-radius: 8px; background: var(--bg-2);
}
.item input { margin: 2px 0 0; accent-color: var(--accent); }
.item .k { color: var(--muted); font-size: 11px; }
.item .v { word-break: break-word; }
.note { color: var(--muted); font-style: italic; }

.status { padding: 10px 16px; border-top: 1px solid var(--line); font-size: 12px; color: var(--muted); min-height: 38px; }
.status.ok { color: var(--ok); }
.status.warn { color: var(--warn); }
.status.err { color: var(--err); }

.spinner {
  width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,.35); border-top-color: #fff;
  animation: spin .7s linear infinite; display: inline-block; vertical-align: -2px; margin-right: 6px;
}
@keyframes spin { to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) { .launcher, .spinner { transition: none; animation: none; } }
`;
