"""Read-only scoped Supabase backup; never prints exported rows or credentials."""

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

PROJECT_REF = "stzilnijaoxwqyuyryts"
GROUP_ID = "8195d6b6-f5a5-455d-a9d6-a8adf37970cd"
TABLES = (
    "groups", "group_members", "group_invites", "group_invite_codes", "players",
    "matches", "match_participants", "live_games", "live_game_players",
    "game_throws", "auth_users", "auth_identities", "auth_mfa_factors",
)


def validate(payload):
    if payload.get("format_version") != 1:
        raise ValueError("Unsupported backup format")
    if payload.get("source_project_ref") != PROJECT_REF or payload.get("group_id") != GROUP_ID:
        raise ValueError("Unexpected source project or group")
    tables = payload["tables"]
    if set(tables) != set(TABLES):
        raise ValueError("Unexpected or missing tables")
    ids = {}
    for name, rows in tables.items():
        if not isinstance(rows, list):
            raise ValueError(f"Invalid rows in {name}")
        ids[name] = {row["id"] for row in rows}
        if len(ids[name]) != len(rows) or None in ids[name]:
            raise ValueError(f"Invalid or duplicate IDs in {name}")
    if len(tables["groups"]) != 1 or ids["groups"] != {GROUP_ID}:
        raise ValueError("Exactly one DIGIMONDO group must exist")
    if tables["groups"][0]["name"].upper() != "DIGIMONDO":
        raise ValueError("Unexpected group name")

    def references(source, field, target, nullable=False):
        for row in tables[source]:
            value = row[field]
            if nullable and value is None:
                continue
            if value not in ids[target]:
                raise ValueError(f"Broken reference: {source}.{field} -> {target}")

    for source in ("group_members", "group_invites", "group_invite_codes", "matches", "live_games"):
        references(source, "group_id", "groups")
    for source in ("group_members", "match_participants"):
        references(source, "player_id", "players")
    references("matches", "winner_id", "players")
    references("matches", "loser_id", "players")
    references("match_participants", "match_id", "matches")
    references("live_game_players", "game_id", "live_games")
    references("live_game_players", "player_id", "players", nullable=True)
    references("game_throws", "game_id", "live_games")
    references("game_throws", "game_player_id", "live_game_players")
    references("players", "user_id", "auth_users", nullable=True)
    references("groups", "created_by", "auth_users", nullable=True)
    references("group_invites", "invited_by", "auth_users", nullable=True)
    references("live_games", "created_by", "auth_users")
    for source in ("auth_identities", "auth_mfa_factors"):
        references(source, "user_id", "auth_users")
    game_players = {row["id"]: row for row in tables["live_game_players"]}
    for row in tables["game_throws"]:
        if game_players[row["game_player_id"]]["game_id"] != row["game_id"]:
            raise ValueError("Throw references a player in another game")

    player_ids = {row["player_id"] for row in tables["group_members"]}
    player_ids.update(row[field] for row in tables["matches"] for field in ("winner_id", "loser_id"))
    player_ids.update(row["player_id"] for row in tables["match_participants"])
    player_ids.update(row["player_id"] for row in tables["live_game_players"] if row["player_id"])
    if player_ids != ids["players"]:
        raise ValueError("Backup contains unrelated or missing players")
    user_ids = {row["user_id"] for row in tables["players"] if row["user_id"]}
    user_ids.update(row["created_by"] for row in tables["groups"] if row["created_by"])
    user_ids.update(row["created_by"] for row in tables["live_games"])
    user_ids.update(row["invited_by"] for row in tables["group_invites"] if row["invited_by"])
    if user_ids != ids["auth_users"]:
        raise ValueError("Backup contains unrelated or missing accounts")
    return {
        "counts": {name: len(tables[name]) for name in TABLES},
        "guest_players": sum(row["user_id"] is None for row in tables["players"]),
        "accounts_with_passwords": sum(bool(row.get("encrypted_password")) for row in tables["auth_users"]),
        "identity_providers": dict(Counter(row["provider"] for row in tables["auth_identities"])),
        "live_game_statuses": dict(Counter(row["status"] for row in tables["live_games"])),
        "historical_players_without_membership": len(player_ids - {row["player_id"] for row in tables["group_members"]}),
    }


def private_write(path, content):
    with path.open("x", encoding="utf-8") as handle:
        os.chmod(path, 0o600)
        handle.write(content)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify", type=Path, help="Verify an existing export and its checksum")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    if args.verify:
        path = args.verify.resolve()
        content = path.read_bytes()
        summary = validate(json.loads(content))
        manifest = json.loads(path.with_name("manifest.json").read_text())
        if hashlib.sha256(content).hexdigest() != manifest["sha256"]:
            raise ValueError("Backup checksum mismatch")
        if manifest["summary"] != summary or manifest["bytes"] != len(content):
            raise ValueError("Backup manifest mismatch")
        print(json.dumps(summary, indent=2))
        return

    # Refuse to query a different linked project even if config.toml was copied.
    ref_file = root / "supabase/.temp/project-ref"
    if not ref_file.exists() or ref_file.read_text().strip() != PROJECT_REF:
        raise ValueError("Supabase CLI must be linked to the expected EloMondo project")
    os.umask(0o077)
    result = subprocess.run(
        ["supabase", "db", "query", "--linked", "--output", "json", "--file",
         str(Path(__file__).with_name("export-digimondo.sql"))],
        cwd=root, capture_output=True, text=True,
    )
    if result.returncode:
        # CLI errors can include credentials or SQL results; do not echo them.
        raise RuntimeError("Supabase export failed; check CLI authentication and project access")
    response = json.loads(result.stdout)
    rows = response if isinstance(response, list) else response.get("rows", [])
    if len(rows) != 1:
        raise ValueError("Expected one complete snapshot result")
    payload = rows[0]["payload"]
    if isinstance(payload, str):
        payload = json.loads(payload)
    summary = validate(payload)
    directory = root / "backups" / ("digimondo-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ"))
    directory.mkdir(parents=True, mode=0o700)
    content = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    raw = content.encode("utf-8")
    private_write(directory / "snapshot.json", content)
    manifest = {
        "format_version": 1, "source_project_ref": PROJECT_REF, "group_id": GROUP_ID,
        "exported_at": payload["exported_at"], "sha256": hashlib.sha256(raw).hexdigest(),
        "bytes": len(raw), "summary": summary,
    }
    private_write(directory / "manifest.json", json.dumps(manifest, indent=2) + "\n")
    print(f"Verified scoped backup: {directory / 'snapshot.json'}")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (KeyError, ValueError, RuntimeError, OSError, json.JSONDecodeError) as error:
        print(f"Backup failed: {error}", file=sys.stderr)
        sys.exit(1)
