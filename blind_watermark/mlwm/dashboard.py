from __future__ import annotations

import argparse
import csv
import json
import os
import subprocess
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse


DEFAULT_RUNS_DIR = Path('artifacts/mlwm_v1/runs')


def _read_text(path: Path, limit: int = 12000) -> str:
  try:
    data = path.read_bytes()
  except OSError:
    return ''
  if len(data) > limit:
    data = data[-limit:]
  return data.decode('utf-8', errors='replace')


def _read_json(path: Path) -> dict[str, Any] | None:
  try:
    return json.loads(path.read_text(encoding='utf-8'))
  except Exception:
    return None


def _read_metrics(path: Path) -> list[dict[str, Any]]:
  if not path.exists():
    return []
  rows: list[dict[str, Any]] = []
  try:
    with path.open('r', encoding='utf-8', newline='') as f:
      for row in csv.DictReader(f):
        parsed: dict[str, Any] = {}
        for key, value in row.items():
          if key == 'stage':
            parsed[key] = value
            continue
          try:
            parsed[key] = float(value) if key != 'epoch' else int(float(value))
          except (TypeError, ValueError):
            parsed[key] = value
        rows.append(parsed)
  except OSError:
    return []
  return rows


def _latest_run(runs_dir: Path) -> Path | None:
  if not runs_dir.exists():
    return None
  candidates = [p for p in runs_dir.iterdir() if p.is_dir()]
  if not candidates:
    return None
  return max(candidates, key=lambda p: p.stat().st_mtime)


def _gpu_status() -> dict[str, Any]:
  query = [
    'nvidia-smi',
    '--query-gpu=name,temperature.gpu,utilization.gpu,memory.used,memory.total,power.draw',
    '--format=csv,noheader,nounits',
  ]
  try:
    row = subprocess.check_output(query, stderr=subprocess.DEVNULL, timeout=5).decode('utf-8').strip().splitlines()[0]
    name, temp, util, mem_used, mem_total, power = [part.strip() for part in row.split(',')]
    return {
      'available': True,
      'name': name,
      'temperatureC': _to_float(temp),
      'utilizationPct': _to_float(util),
      'memoryUsedMB': _to_float(mem_used),
      'memoryTotalMB': _to_float(mem_total),
      'powerW': _to_float(power),
    }
  except Exception as exc:
    return {'available': False, 'error': str(exc)}


def _to_float(value: str) -> float | None:
  try:
    return float(value)
  except ValueError:
    return None


def _training_processes() -> list[dict[str, Any]]:
  if os.name == 'nt':
    cmd = [
      'powershell',
      '-NoProfile',
      '-Command',
      (
        "Get-CimInstance Win32_Process | "
        "Where-Object { $_.Name -like 'python*' -and $_.CommandLine -like '*blind_watermark.mlwm.train*' } | "
        "Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress"
      ),
    ]
    try:
      raw = subprocess.check_output(cmd, stderr=subprocess.DEVNULL, timeout=8).decode('utf-8').strip()
      if not raw:
        return []
      data = json.loads(raw)
      if isinstance(data, dict):
        data = [data]
      return [
        {
          'pid': item.get('ProcessId'),
          'parentPid': item.get('ParentProcessId'),
          'command': item.get('CommandLine'),
        }
        for item in data
      ]
    except Exception:
      return []
  try:
    raw = subprocess.check_output(['ps', '-eo', 'pid,ppid,args'], stderr=subprocess.DEVNULL, timeout=5).decode('utf-8')
  except Exception:
    return []
  rows = []
  for line in raw.splitlines()[1:]:
    if 'blind_watermark.mlwm.train' not in line:
      continue
    parts = line.strip().split(maxsplit=2)
    if len(parts) == 3:
      rows.append({'pid': int(parts[0]), 'parentPid': int(parts[1]), 'command': parts[2]})
  return rows


def _estimate_progress(metrics: list[dict[str, Any]], config: dict[str, Any] | None, run_dir: Path) -> dict[str, Any]:
  total_epochs = None
  if config:
    total_epochs = 0
    for stage in ['warmup', 'main', 'hard_negative', 'finalize']:
      stage_cfg = (config.get('stages') or {}).get(stage) or {}
      if stage_cfg.get('enabled', False):
        total_epochs += int(stage_cfg.get('epochs', 0))
  done = int(metrics[-1]['epoch']) if metrics else 0
  first_metric_time = None
  metrics_path = run_dir / 'metrics_epoch.csv'
  if metrics_path.exists() and done > 0:
    first_metric_time = metrics_path.stat().st_mtime
  elapsed_seconds = None
  eta_seconds = None
  if metrics and first_metric_time:
    created = (run_dir / 'train_config_resolved.yaml').stat().st_mtime if (run_dir / 'train_config_resolved.yaml').exists() else run_dir.stat().st_mtime
    elapsed_seconds = max(1.0, time.time() - created)
    seconds_per_epoch = elapsed_seconds / max(done, 1)
    if total_epochs:
      eta_seconds = max(0.0, (total_epochs - done) * seconds_per_epoch)
  pct = (done / total_epochs * 100.0) if total_epochs else None
  return {
    'doneEpochs': done,
    'totalEpochs': total_epochs,
    'percent': pct,
    'elapsedSeconds': elapsed_seconds,
    'etaSeconds': eta_seconds,
  }


def build_status(runs_dir: Path, run_arg: str | None) -> dict[str, Any]:
  run_dir = Path(run_arg) if run_arg else (_latest_run(runs_dir) or runs_dir)
  if not run_dir.is_absolute():
    run_dir = run_dir.resolve()
  config = _read_json(run_dir / 'train_config_resolved.json')
  if config is None:
    try:
      import yaml

      config = yaml.safe_load((run_dir / 'train_config_resolved.yaml').read_text(encoding='utf-8')) or {}
    except Exception:
      config = None
  metrics = _read_metrics(run_dir / 'metrics_epoch.csv')
  manifest = _read_json(run_dir / 'run_manifest.json')
  latest = metrics[-1] if metrics else None
  best = None
  if metrics:
    best = max(metrics, key=lambda row: float(row.get('val_payload_acc') or 0) + float(row.get('val_exact_match') or 0))
  return {
    'runDir': str(run_dir),
    'runName': run_dir.name,
    'exists': run_dir.exists(),
    'updatedAt': time.strftime('%Y-%m-%d %H:%M:%S'),
    'metrics': metrics,
    'latest': latest,
    'best': best,
    'progress': _estimate_progress(metrics, config, run_dir) if run_dir.exists() else {},
    'manifest': manifest,
    'gpu': _gpu_status(),
    'processes': _training_processes(),
    'logs': {
      'stdout': _read_text(run_dir / 'stdout.log'),
      'stderr': _latest_launch_stderr(run_dir),
    },
  }


def _latest_launch_stderr(run_dir: Path) -> str:
  root = run_dir.parents[1] if len(run_dir.parents) >= 2 else Path('artifacts/mlwm_v1')
  log_dir = root / 'launch_logs'
  if not log_dir.exists():
    return ''
  candidates = sorted(log_dir.glob('*.err.log'), key=lambda p: p.stat().st_mtime, reverse=True)
  return _read_text(candidates[0]) if candidates else ''


HTML = r'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MLWM Training Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.9/dist/chart.umd.min.js"></script>
  <style>
    :root { color-scheme: dark; --bg:#101113; --panel:#191b1f; --muted:#8f98a3; --text:#edf0f2; --line:#2b3036; --green:#60d394; --blue:#6db3ff; --red:#ff6b6b; --yellow:#ffd166; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background:var(--bg); color:var(--text); }
    header { padding:22px 26px 12px; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; align-items:flex-end; gap:20px; }
    h1 { margin:0; font-size:24px; letter-spacing:0; }
    .sub { color:var(--muted); font-size:13px; margin-top:6px; }
    main { padding:22px 26px 30px; display:grid; grid-template-columns: repeat(12, 1fr); gap:16px; }
    .card { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px; min-width:0; }
    .span3 { grid-column: span 3; } .span4 { grid-column: span 4; } .span6 { grid-column: span 6; } .span8 { grid-column: span 8; } .span12 { grid-column: span 12; }
    .label { color:var(--muted); font-size:12px; text-transform:uppercase; font-weight:700; letter-spacing:.08em; }
    .value { font-size:26px; margin-top:6px; font-weight:760; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .small { color:var(--muted); font-size:13px; margin-top:6px; overflow-wrap:anywhere; }
    .bar { height:10px; background:#0f1114; border:1px solid var(--line); border-radius:999px; overflow:hidden; margin-top:12px; }
    .bar > div { height:100%; width:0; background:linear-gradient(90deg,var(--blue),var(--green)); transition:width .3s ease; }
    canvas { width:100% !important; height:300px !important; }
    pre { margin:0; max-height:220px; overflow:auto; color:#d6dde5; font-size:12px; line-height:1.45; white-space:pre-wrap; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th, td { padding:8px 6px; border-bottom:1px solid var(--line); text-align:left; }
    th { color:var(--muted); font-size:12px; }
    .pill { display:inline-flex; align-items:center; gap:7px; padding:6px 9px; border-radius:999px; background:#111317; border:1px solid var(--line); font-size:13px; color:var(--muted); }
    .dot { width:8px; height:8px; border-radius:50%; background:var(--red); }
    .dot.on { background:var(--green); }
    @media (max-width: 980px) { main { grid-template-columns:1fr; } .span3,.span4,.span6,.span8,.span12 { grid-column:span 1; } header { display:block; } }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>MLWM Training Dashboard</h1>
      <div class="sub" id="runName">Loading...</div>
    </div>
    <div class="pill"><span class="dot" id="liveDot"></span><span id="liveText">checking</span></div>
  </header>
  <main>
    <section class="card span3"><div class="label">Epoch</div><div class="value" id="epoch">-</div><div class="bar"><div id="progressBar"></div></div><div class="small" id="progressText">-</div></section>
    <section class="card span3"><div class="label">Stage</div><div class="value" id="stage">-</div><div class="small" id="eta">-</div></section>
    <section class="card span3"><div class="label">Payload Accuracy</div><div class="value" id="acc">-</div><div class="small" id="best">-</div></section>
    <section class="card span3"><div class="label">GPU</div><div class="value" id="gpu">-</div><div class="small" id="gpuDetail">-</div></section>
    <section class="card span6"><div class="label">Accuracy</div><canvas id="accChart"></canvas></section>
    <section class="card span6"><div class="label">Loss</div><canvas id="lossChart"></canvas></section>
    <section class="card span8"><div class="label">Recent Epochs</div><table><thead><tr><th>Epoch</th><th>Stage</th><th>Loss</th><th>Payload Acc</th><th>Exact</th><th>Confidence</th></tr></thead><tbody id="rows"></tbody></table></section>
    <section class="card span4"><div class="label">Process</div><pre id="processes"></pre></section>
    <section class="card span6"><div class="label">stderr</div><pre id="stderr"></pre></section>
    <section class="card span6"><div class="label">stdout</div><pre id="stdout"></pre></section>
  </main>
  <script>
    const fmtPct = v => (v === null || v === undefined || Number.isNaN(v)) ? '-' : (v * 100).toFixed(2) + '%';
    const fmtNum = v => (v === null || v === undefined || Number.isNaN(v)) ? '-' : Number(v).toFixed(4);
    const fmtSec = s => {
      if (!s && s !== 0) return '-';
      s = Math.max(0, Math.round(s));
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };
    const chartOpts = { responsive:true, maintainAspectRatio:false, animation:false, scales:{ x:{ grid:{ color:'#252a30' } }, y:{ grid:{ color:'#252a30' } } }, plugins:{ legend:{ labels:{ color:'#dce2e8' } } } };
    const accChart = new Chart(document.getElementById('accChart'), { type:'line', data:{ labels:[], datasets:[
      { label:'payload acc', data:[], borderColor:'#60d394', tension:.25 },
      { label:'exact match', data:[], borderColor:'#6db3ff', tension:.25 },
    ]}, options: chartOpts });
    const lossChart = new Chart(document.getElementById('lossChart'), { type:'line', data:{ labels:[], datasets:[
      { label:'train loss', data:[], borderColor:'#ffd166', tension:.25 },
    ]}, options: chartOpts });
    async function refresh() {
      const res = await fetch('/api/status');
      const data = await res.json();
      const latest = data.latest || {};
      const progress = data.progress || {};
      document.getElementById('runName').textContent = `${data.runName || '-'} · ${data.runDir || ''}`;
      const live = (data.processes || []).length > 0;
      document.getElementById('liveDot').className = 'dot ' + (live ? 'on' : '');
      document.getElementById('liveText').textContent = live ? 'training process active' : 'no training process detected';
      document.getElementById('epoch').textContent = `${progress.doneEpochs || 0}/${progress.totalEpochs || '?'}`;
      document.getElementById('progressText').textContent = progress.percent ? `${progress.percent.toFixed(1)}% complete` : '-';
      document.getElementById('progressBar').style.width = `${Math.min(100, progress.percent || 0)}%`;
      document.getElementById('stage').textContent = latest.stage || '-';
      document.getElementById('eta').textContent = `ETA ${fmtSec(progress.etaSeconds)} · elapsed ${fmtSec(progress.elapsedSeconds)}`;
      document.getElementById('acc').textContent = fmtPct(latest.val_payload_acc);
      document.getElementById('best').textContent = data.best ? `best epoch ${data.best.epoch}: ${fmtPct(data.best.val_payload_acc)}` : '-';
      const gpu = data.gpu || {};
      document.getElementById('gpu').textContent = gpu.available ? `${gpu.utilizationPct ?? 0}%` : 'n/a';
      document.getElementById('gpuDetail').textContent = gpu.available ? `${gpu.name} · ${gpu.temperatureC}C · ${gpu.memoryUsedMB}/${gpu.memoryTotalMB} MB` : (gpu.error || '-');
      const metrics = data.metrics || [];
      const labels = metrics.map(r => r.epoch);
      accChart.data.labels = labels;
      accChart.data.datasets[0].data = metrics.map(r => r.val_payload_acc);
      accChart.data.datasets[1].data = metrics.map(r => r.val_exact_match);
      accChart.update();
      lossChart.data.labels = labels;
      lossChart.data.datasets[0].data = metrics.map(r => r.train_loss);
      lossChart.update();
      document.getElementById('rows').innerHTML = metrics.slice(-12).reverse().map(r => `<tr><td>${r.epoch}</td><td>${r.stage}</td><td>${fmtNum(r.train_loss)}</td><td>${fmtPct(r.val_payload_acc)}</td><td>${fmtPct(r.val_exact_match)}</td><td>${fmtPct(r.val_confidence)}</td></tr>`).join('');
      document.getElementById('processes').textContent = (data.processes || []).map(p => `pid=${p.pid} parent=${p.parentPid}\n${p.command}`).join('\n\n') || 'No training process detected.';
      document.getElementById('stderr').textContent = (data.logs && data.logs.stderr) || '';
      document.getElementById('stdout').textContent = (data.logs && data.logs.stdout) || '';
    }
    refresh();
    setInterval(refresh, 5000);
  </script>
</body>
</html>'''


class DashboardHandler(BaseHTTPRequestHandler):
  runs_dir: Path = DEFAULT_RUNS_DIR
  run_arg: str | None = None

  def do_GET(self) -> None:
    parsed = urlparse(self.path)
    if parsed.path == '/api/status':
      qs = parse_qs(parsed.query)
      run = qs.get('run', [self.run_arg])[0]
      self._send_json(build_status(self.runs_dir, run))
      return
    if parsed.path in {'/', '/index.html'}:
      self._send_bytes(HTML.encode('utf-8'), 'text/html; charset=utf-8')
      return
    self.send_error(404)

  def log_message(self, format: str, *args: Any) -> None:
    return

  def _send_json(self, payload: Any) -> None:
    self._send_bytes(json.dumps(payload, ensure_ascii=False).encode('utf-8'), 'application/json; charset=utf-8')

  def _send_bytes(self, payload: bytes, content_type: str) -> None:
    self.send_response(200)
    self.send_header('Content-Type', content_type)
    self.send_header('Cache-Control', 'no-store')
    self.send_header('Content-Length', str(len(payload)))
    self.end_headers()
    self.wfile.write(payload)


def main() -> None:
  parser = argparse.ArgumentParser(description='Serve a live MLWM training dashboard')
  parser.add_argument('--runs-dir', default=str(DEFAULT_RUNS_DIR))
  parser.add_argument('--run', help='Specific run directory. Defaults to the newest run.')
  parser.add_argument('--host', default='127.0.0.1')
  parser.add_argument('--port', type=int, default=8765)
  parser.add_argument('--open', action='store_true', help='Open the dashboard in the default browser.')
  args = parser.parse_args()

  DashboardHandler.runs_dir = Path(args.runs_dir)
  DashboardHandler.run_arg = args.run
  server = ThreadingHTTPServer((args.host, args.port), DashboardHandler)
  url = f'http://{args.host}:{args.port}/'
  print(f'MLWM dashboard: {url}', flush=True)
  if args.open:
    webbrowser.open(url)
  try:
    server.serve_forever()
  except KeyboardInterrupt:
    pass


if __name__ == '__main__':
  main()
