#!/usr/bin/env bash
# Never trace config reads or password environment assignments, even with bash -x.
set +x
set -euo pipefail

die() { printf '%s\n' "$*" >&2; exit 1; }
[[ $# == 0 ]] || die 'Usage: bash deploy/upload.sh (configure SFTP_OLONA and SFTP_OLONA_DIR in .env)'
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
[[ -f .env && -r .env ]] || die 'Missing readable .env; copy .env.example to .env and fill in SFTP_OLONA and SFTP_OLONA_DIR.'
unset host remote_dir password_reference
# Read literal values only: never execute shell syntax from deployment config.
while IFS= read -r line || [[ -n $line ]]; do
  line=${line%$'\r'}
  [[ $line =~ ^[[:space:]]*(#|$) ]] && continue
  case $line in
    SFTP_OLONA=*)
      [[ ! ${host+x} ]] || die 'Duplicate SFTP_OLONA in .env.'
      host=${line#*=}
      ;;
    SFTP_OLONA_DIR=*)
      [[ ! ${remote_dir+x} ]] || die 'Duplicate SFTP_OLONA_DIR in .env.'
      remote_dir=${line#*=}
      ;;
    SFTP_OLONA_PW=*)
      [[ ! ${password_reference+x} ]] || die 'Duplicate SFTP_OLONA_PW in .env.'
      [[ $line == 'SFTP_OLONA_PW=${SFTP_OLONA_PW}' ]] || die 'SFTP_OLONA_PW in .env must be the literal reference ${SFTP_OLONA_PW}, never a password.'
      password_reference=1
      ;;
    *) die 'Invalid .env line; only SFTP_OLONA, SFTP_OLONA_DIR and the SFTP_OLONA_PW reference are allowed.' ;;
  esac
done < .env
[[ ${host+x} && ${remote_dir+x} && ${password_reference+x} ]] || die '.env must define SFTP_OLONA, SFTP_OLONA_DIR and SFTP_OLONA_PW=${SFTP_OLONA_PW}.'
[[ $host =~ ^[a-zA-Z0-9_][a-zA-Z0-9_.-]*(@[a-zA-Z0-9_][a-zA-Z0-9_.-]*)?$ ]] || die \
  'SFTP_OLONA must be user@host or an SSH config alias; configure ports/keys in ~/.ssh/config.'
[[ $remote_dir =~ ^(/[a-zA-Z0-9_.-]+)*/questlog$ && $remote_dir != *'/../'* && $remote_dir != *'/./'* ]] || die \
  'SFTP_OLONA_DIR must be an absolute SFTP path ending in /questlog, using only letters, digits, _, -, . and /; no . or .. components.'
command -v sftp >/dev/null || die 'Missing local command: sftp'
if [[ -n ${SFTP_OLONA_PW:-} ]]; then
  command -v sshpass >/dev/null || die 'Password mode requires local sshpass; install it or unset SFTP_OLONA_PW to use SSH keys/agent.'
fi
files=(index.html app.js styles.css tailwind.config.js data/catalog.json server/api.php)
for file in "${files[@]}"; do
  [[ -f $file && ! -L $file ]] || die "Missing runtime file or unexpected symlink: $file"
done

upload() {
  if [[ -n ${SFTP_OLONA_PW:-} ]]; then
    # SSH uses the first option value: BatchMode=no MUST precede -b.
    # sshpass answers the password prompt via a PTY, not the batch input.
    SSHPASS=$SFTP_OLONA_PW sshpass -e sftp -oBatchMode=no -oStrictHostKeyChecking=yes -b - "$host"
  else
    sftp -oStrictHostKeyChecking=yes -b - "$host"
  fi
}

# Initial directory creation and access control are manual; never upload state or .htaccess.
# Batch mode aborts on failed cd/put and propagates the failure to this script.
{
  printf 'cd "%s"\n' "$remote_dir"
  for file in "${files[@]}"; do printf 'put "%s" "%s"\n' "$file" "$file"; done
} | upload
printf '%s\n' 'Upload complete. Reload clients and verify HTTPS access control and saved-state persistence.'
