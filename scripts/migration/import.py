"""Import a verified scoped snapshot to Convex using admin-only mutations."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import subprocess
import sys
import zipfile
from backup import validate

BUSINESS_TABLES = ('groups', 'players', 'group_members', 'group_invite_codes', 'group_invites', 'matches', 'match_participants', 'live_games', 'live_game_players', 'game_throws')


def transformed(payload):
    validate(payload)
    tables = {name: [dict(row) for row in payload['tables'][name]] for name in BUSINESS_TABLES}
    # Add an indexed group reference for inexpensive, paginated throw analytics.
    games = {row['id']: row for row in tables['live_games']}
    for row in tables['game_throws']:
        row['group_id'] = games[row['game_id']]['group_id']
    users = []
    seen_emails = set()
    for user in payload['tables']['auth_users']:
        email = (user.get('email') or '').strip().lower()
        if not email or email in seen_emails:
            raise ValueError('Missing or duplicate normalized account email')
        seen_emails.add(email)
        if user.get('is_sso_user') or user.get('is_anonymous'):
            raise ValueError('Unsupported authentication method; inspect before migration')
        if any(identity['provider'] != 'email' for identity in payload['tables']['auth_identities'] if identity['user_id'] == user['id']):
            raise ValueError('Non-email identity needs a separate migration strategy')
        banned = user.get('banned_until')
        disabled = bool(user.get('deleted_at')) or bool(banned and datetime.fromisoformat(banned.replace('Z', '+00:00')) > datetime.now(timezone.utc))
        row = {'legacyId': user['id'], 'email': email, 'disabled': disabled}
        name = (user.get('raw_user_meta_data') or {}).get('name')
        if name:
            row['name'] = name
        if user.get('email_confirmed_at'):
            row['emailVerificationTime'] = int(datetime.fromisoformat(user['email_confirmed_at'].replace('Z', '+00:00')).timestamp() * 1000)
        users.append(row)
    if payload['tables']['auth_mfa_factors']:
        raise ValueError('MFA needs a separate migration strategy')
    return tables, users


def verify_export(archive, payload):
    tables, accounts = transformed(payload)
    with zipfile.ZipFile(archive) as zip_file:
        names = set(zip_file.namelist())
        def read_table(name):
            filename = f'{name}/documents.jsonl'
            return [json.loads(line) for line in zip_file.read(filename).decode().splitlines() if line] if filename in names else []
        for name, expected in tables.items():
            actual = [{k: v for k, v in row.items() if k not in ('_id', '_creationTime')} for row in read_table(name)]
            if sorted(actual, key=lambda r: r['id']) != sorted(expected, key=lambda r: r['id']):
                raise ValueError(f'Exported {name} differs from the source (counts {len(actual)} / {len(expected)})')
        users = read_table('users')
        if len(users) != len(accounts):
            raise ValueError('Account count differs from source')
        user_ids = {row['legacyId']: row['_id'] for row in users}
        auth_accounts = read_table('authAccounts')
        if len(auth_accounts) != len(accounts):
            raise ValueError('Authentication account count differs from source')
        for expected in accounts:
            user = next((u for u in users if u.get('legacyId') == expected['legacyId']), None)
            if not user or any(user.get(k) != v for k, v in expected.items()):
                raise ValueError('Imported account metadata differs from source')
            account = next((a for a in auth_accounts if a['userId'] == user_ids[expected['legacyId']]), None)
            if not account or account['provider'] != 'password' or account['providerAccountId'] != expected['email']:
                raise ValueError('Imported account mapping differs from source')
            if account.get('secret'):
                raise ValueError('Unexpected password in reset-only import')
    return {**{name: len(rows) for name, rows in tables.items()}, 'users': len(accounts), 'authAccounts': len(accounts)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('snapshot', type=Path)
    parser.add_argument('--prod', action='store_true', help='Import into the production backend')
    parser.add_argument('--verify-export', type=Path, help='Verify an already-exported Convex ZIP instead of importing')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    snapshot = args.snapshot.resolve()
    # Validate checksum and every reference before creating any destination rows.
    checked = subprocess.run([sys.executable, str(Path(__file__).with_name('backup.py')), '--verify', str(snapshot)], capture_output=True, text=True)
    if checked.returncode:
        raise ValueError('Source snapshot failed checksum/reference verification')
    payload = json.loads(snapshot.read_text())
    tables, users = transformed(payload)
    if args.verify_export:
        print(json.dumps(verify_export(args.verify_export, payload), indent=2))
        return
    print('Target:', 'production' if args.prod else 'development', flush=True)
    print(json.dumps({**{name: len(rows) for name, rows in tables.items()}, 'users': len(users)}, indent=2), flush=True)
    if args.dry_run:
        return
    os.umask(0o077)
    log = snapshot.with_name('convex-import-' + ('prod' if args.prod else 'dev') + '.log')
    with log.open('a') as handle:
        def run(command):
            result = subprocess.run(command, cwd=root, capture_output=True, text=True)
            if result.returncode:
                handle.write(result.stdout + result.stderr)
                raise RuntimeError(f'Convex command failed; details are in the private log {log}')
        target = ['--prod'] if args.prod else []
        run(['npx', 'convex', 'run', 'migration:importAccounts', json.dumps({'rows': users}), *target])
        for name, rows in tables.items():
            for offset in range(0, len(rows), 150):
                run(['npx', 'convex', 'run', 'migration:importBatch', json.dumps({'batch': {'table': name, 'rows': rows[offset:offset + 150]}}), *target])
            print(f'Imported {name}: {len(rows)}', flush=True)
        archive = snapshot.with_name('convex-' + ('prod' if args.prod else 'dev') + '-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.zip')
        run(['npx', 'convex', 'export', '--path', str(archive), *target])
    counts = verify_export(archive, payload)
    report = {'export_archive': str(archive), 'source_snapshot': str(snapshot), 'target': 'production' if args.prod else 'development', 'verified_counts': counts}
    report_path = archive.with_suffix('.verification.json')
    report_path.write_text(json.dumps(report, indent=2) + '\n')
    print('All imported rows and account mappings verified against a fresh Convex export.', flush=True)
    print('Report:', report_path, flush=True)


if __name__ == '__main__':
    try:
        main()
    except (KeyError, ValueError, RuntimeError, OSError, zipfile.BadZipFile) as error:
        print(f'Import failed: {error}', file=sys.stderr)
        sys.exit(1)
