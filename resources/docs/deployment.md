# Safe hosting and one.com SFTP deployment

For local use, follow the [README quick start](../../README.md#quick-start).
This runbook covers Apache hosting under `/questlog/`, without a remote shell.

## Protect the site before uploading

**Do not publish this API without whole-site password protection.** The Parent
PIN is only a UI convenience: anyone with API access can read, replace or reset
the family snapshot. All users sharing the hosting password can do this,
including children; this is not secure parent/child authorization.

One-time setup in the hosting panel/File Manager or an SFTP client:

1. Confirm the plan provides **SFTP** and obtain its host, username and remote
   path. FTP/FTPS is not SFTP; SFTP availability is separate from SSH shell access.
   Select web PHP **8.1+**, with `fsync` and directory syncing supported. Confirm
   Apache **2.4+**, `mod_rewrite` and `.htaccess` overrides for `Options`,
   `DirectoryIndex` and rewrite rules with the host.
2. Create `questlog/` under the web document root, containing `data/` and `server/`.
   Use real files/directories, not symlinks. Allow PHP to create/write `state/`
   (or create it privately with mode 700 for the PHP user). Leave existing state
   untouched; never use permissions 777.
3. Enable HTTPS and provider password protection for **all of `/questlog/` and
   its descendants**, including API/assets, before uploading runtime files.
   Append [deploy/htaccess.rules](../../deploy/htaccess.rules) to
   **`/questlog/.htaccess`**, after any provider authentication directives.
   Do not replace those directives or install these rules at the domain root.
   The template provides routing, not authentication; do not upload it into
   `server/` or as a runtime file. Keep credentials outside the repository.
4. Install local OpenSSH `sftp`. Verify the server host-key fingerprint through
   a trusted provider channel and register it in SSH `known_hosts` (for example,
   via a manual SFTP connection). Unknown/changed keys fail strict verification;
   never disable it. Use an SSH config alias for a custom port/key. Configure
   keys/agent authentication, or install local `sshpass` for password mode below.
   No remote shell, rsync or CLI PHP is needed.

## Configure and upload

From the repository root:

```sh
cp .env.example .env
```

Edit the local `.env`:

- `SFTP_OLONA`: `user@host` or a simple SSH config alias.
- `SFTP_OLONA_DIR`: the **absolute SFTP-visible path** to the deployed `questlog`
  folder, not a URL (the SFTP root may be chrooted). It must end in `/questlog`,
  contain only letters, digits, `_`, `-`, `.` and `/`, with no spaces, trailing
  slash, repeated slashes or `.`/`..` components. Directories must already exist.
- Leave `SFTP_OLONA_PW=${SFTP_OLONA_PW}` exactly as written: a non-secret reference
  to the exported environment variable, **not a place to enter a password**.

These three keys are required exactly once, with literal unquoted values and
no spaces around `=`. Blank lines and full-line `#` comments are allowed;
shell expansion, `export`, inline comments and additional keys are not supported.
The destination comes only from this repository-root file, not environment
variables or positional arguments. The script validates the password reference
literally and never sources `.env`; the file is gitignored and never uploaded.
Keep actual passwords, tokens and private keys out of it and the repository.

An unset/empty exported `SFTP_OLONA_PW` uses batch key/agent authentication with
no password prompt or `sshpass` dependency; unlock your agent beforehand.
For password mode, supply a nonempty **exported `SFTP_OLONA_PW`** through your
system environment/secret manager before running the script. Never put it in
command arguments, shell history or repository files. The script passes it as
`SSHPASS` to `sshpass -e`, not in a batch command or log. It sets `BatchMode=no`
before `-b` so password authentication works while retaining batch error handling.
Only ordinary SSH passwords are supported, not MFA/arbitrary interactive
challenges. Missing `sshpass` fails with guidance, not an interactive fallback.

Use a trusted local machine: privileged processes, and sometimes other processes
under your user, can inspect environment secrets. Keys/agent are preferable.
Avoid environment dumps/debug logging and unset `SFTP_OLONA_PW` afterwards.
The script disables shell tracing to avoid logging its password assignment.

Upload with:

```sh
bash deploy/upload.sh
```

The script uses SFTP batch `cd`/`put` to upload only `index.html`, `app.js`,
`styles.css`, `tailwind.config.js`, `data/catalog.json` and `server/api.php`.
It never uploads local state, edits remote `.htaccess`, deletes remote files or
changes existing state. Failures return nonzero; **uploads are not atomic**.
Pause use and rerun after fixing a partial failure, then reload clients.
Do not reset state to recover an upload failure.

## Verify before use

Access control is a **manual hosting responsibility**, not checked by the script.
On every domain alias:

- Without hosting credentials, `/questlog/`, `/questlog/api.php`,
  `/questlog/app.js` and `/questlog/data/catalog.json` must require HTTP **401**.
- After signing in, the chooser/assets/catalog should load and `/questlog/api.php`
  should return JSON. The per-directory rules rewrite this virtual API to
  `questlog/server/api.php` using `[END]`.
- Direct `/questlog/server/api.php`, `/questlog/state/state.json`,
  `/questlog/state/backups/`, `/questlog/.htaccess`, `/questlog/.git/config` and
  unknown paths must be denied (**403/404**), never served or listed.
- Confirm a UI change survives reload and later uploads.

If any check fails, disable public access until hosting configuration is fixed.
These instructions do not perform deployment or smoke checks automatically.
