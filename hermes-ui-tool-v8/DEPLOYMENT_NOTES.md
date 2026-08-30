# ARI / Hermes UI deployment notes

## Runtime assumptions

The voice API resolves Hermes from `HERMES_HOME`:
- Windows: `%LOCALAPPDATA%/hermes`
- Linux/macOS: `~/.hermes`
- Override with `HERMES_HOME` when needed.

The Hermes source root can be overridden with `HERMES_AGENT_ROOT`.

The app expects the managed Hermes Python environment at:
- Windows: `HERMES_HOME/hermes-agent/venv/Scripts/python.exe`
- Linux/macOS: `HERMES_HOME/hermes-agent/venv/bin/python`

## Production deployment

After source changes on the Ubuntu server:

```bash
npm run build
sudo systemctl restart ari
sudo systemctl status ari --no-pager
```

Do not serve the production service from an old `.next` build.

## Security

Private keys and environment files must stay outside the repository. Do not put PEM keys in `public/`.
