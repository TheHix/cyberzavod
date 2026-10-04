#!/usr/bin/env bash
# Граница доверия скрипта выкатки: всё, кроме полного sha, отклоняется кодом 2 до любых действий.
# Запускается в контейнере от root (`make check-deploy`), поэтому скрипт не переходит в sudo.
set -uo pipefail

SCRIPT="$(dirname "$0")/cyberzavod-deploy"
readonly SCRIPT
readonly REJECTED_EXIT_CODE=2
readonly VALID_SHA=0123456789abcdef0123456789abcdef01234567

invalid_inputs=(
  ""
  "abc"
  "${VALID_SHA:0:39}"
  "${VALID_SHA}0"
  "${VALID_SHA^^}"
  "${VALID_SHA}; id"
  "\$(id)"
  "../../etc/passwd"
)

failed=0
for input in "${invalid_inputs[@]}"; do
  "$SCRIPT" "$input" > /dev/null 2>&1
  code=$?

  if [[ $code -ne $REJECTED_EXIT_CODE ]]; then
    echo "не отклонён: '$input' (код $code)" >&2
    failed=1
  fi
done

if [[ $failed -eq 0 ]]; then
  echo "cyberzavod-deploy: недопустимые sha отклоняются (${#invalid_inputs[@]} случаев)"
fi
exit "$failed"
