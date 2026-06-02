#!/usr/bin/env bash
# UserPromptSubmit hook: si el prompt habla de algo front-end, inyecta un
# recordatorio para recomendar qué skills de diseño usar antes de escribir código.
# Preferencia del usuario (ver memoria: recommend-frontend-skills).

p=$(jq -r '.prompt // empty')

if echo "$p" | grep -qiE 'landing|dashboard|front[- ]?end|frontend|componente|interfaz|página|pagina|sitio web|web ?app|maqueta|portfolio|rediseñ|redesign|tailwind|\breact\b|next\.?js|\bcss\b|\bui\b|\bux\b'; then
  cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"RECORDATORIO (preferencia del usuario): antes de iniciar cualquier proyecto front-end, recomienda proactivamente qué skills de diseño usar para este caso concreto ANTES de escribir código. Combinación base recomendada (no se contradicen): design-taste-frontend + high-end-visual-design + emil-design-eng; ajusta según la estética (minimalist-ui, industrial-brutalist-ui), usa redesign-existing-projects para rediseños e impeccable para auditar. Las skills imagegen-*/brandkit/image-to-code no aplican aquí (no se generan imágenes)."}}
JSON
fi
exit 0
