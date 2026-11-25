#!/usr/bin/env bash
# Decides which commit the api and the web app are released at, and stops a
# release that would be unsafe. Used by .github/workflows/release.yml.
#
# Reads   COMMIT        full commit SHA to release; empty = what staging runs now
#         ALLOW_OLDER   "true" lets production move back to an older commit
#         RELEASE_API, RELEASE_WEB   "true" for each app to release
# Writes  api_commit and web_commit to $GITHUB_OUTPUT (left out when not released)
#         a table of the plan to $GITHUB_STEP_SUMMARY
# Needs   flyctl (signed in), jq, and a full clone with origin/main.
set -euo pipefail

fail() {
  echo "::error::$*" >&2
  exit 1
}

# The commit an app's machines run, read from the image tag. Empty when nothing is deployed.
running_commit() {
  local app="$1" tags
  tags="$(flyctl image show --app "$app" --json | jq -r 'if . == null then "" else [.[].Tag] | unique | join(" ") end')"
  if [[ "$tags" == *" "* ]]; then
    fail "$app is running more than one image ($tags). Wait for its deploy to finish, then run Release again."
  fi
  echo "$tags"
}

# True when this commit's image finished a deploy on the staging app at some point.
was_on_staging() {
  local app="$1" commit="$2"
  flyctl releases --app "$app" --json |
    jq -e --arg ref "registry.fly.io/$app:$commit" 'any(.[]?; .ImageRef == $ref and .Status == "complete")' >/dev/null
}

plan_app() {
  local name="$1" staging="$2" production="$3" target current note="newer than production"
  if [[ -n "$COMMIT" ]]; then
    target="$COMMIT"
    [[ "$target" =~ ^[0-9a-f]{40}$ ]] || fail "commit must be a full 40-character SHA, got '$target'."
    was_on_staging "$staging" "$target" ||
      fail "$target was never deployed to $staging, so there is no tested $name image for it. Untick $name or pick another commit."
  else
    target="$(running_commit "$staging")"
    [[ -n "$target" ]] || fail "$staging has nothing deployed, so there is nothing to release for $name."
    [[ "$target" =~ ^[0-9a-f]{40}$ ]] || fail "$staging runs an image tagged '$target', which is not a commit SHA."
  fi
  git merge-base --is-ancestor "$target" origin/main 2>/dev/null ||
    fail "$target is not a commit on main. Only commits on main are released."

  current="$(running_commit "$production")"
  if [[ -z "$current" ]]; then
    note="first release"
  elif [[ "$current" == "$target" ]]; then
    note="same as production (redeploy)"
  elif ! git merge-base --is-ancestor "$current" "$target" 2>/dev/null; then
    [[ "$ALLOW_OLDER" == "true" ]] ||
      fail "$name: production runs $current, and $target does not include it, so this would move production backwards. Tick 'allow older' if this is a rollback."
    note="ROLLBACK: older than production"
  fi

  echo "${name}_commit=$target" >>"$GITHUB_OUTPUT"
  echo "| $name | \`${target::7}\` | ${current:+\`${current::7}\`} | $note |" >>"$GITHUB_STEP_SUMMARY"
}

{
  echo "### Release plan"
  echo "| App | Releasing | In production now | Note |"
  echo "|---|---|---|---|"
} >>"$GITHUB_STEP_SUMMARY"

if [[ "$RELEASE_API" == "true" ]]; then plan_app api spaced-rep-api-staging spaced-rep-api; fi
if [[ "$RELEASE_WEB" == "true" ]]; then plan_app web spaced-rep-web-staging spaced-rep-web; fi
