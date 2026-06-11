{{/*
Expand the name of the chart.
*/}}
{{- define "collabora-online.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "collabora-online.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "collabora-online.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "collabora-online.labels" -}}
helm.sh/chart: {{ include "collabora-online.chart" . }}
{{ include "collabora-online.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "collabora-online.selectorLabels" -}}
app.kubernetes.io/name: {{ include "collabora-online.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Selector Log labels
*/}}
{{- define "collabora-online.selectorLogLabels" -}}
{{- if .Values.logging.dedot }}
app{{.Values.logging.dedot }}kubernetes{{.Values.logging.dedot }}io/name: {{ include "collabora-online.name" . }}
app{{.Values.logging.dedot }}kubernetes{{.Values.logging.dedot }}io/instance: {{ .Release.Name }}
{{- else }}
{{ include "collabora-online.selectorLabels" . }}
{{- end }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "collabora-online.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "collabora-online.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create the name of the SeccompProfileDaemonSet service account to use
*/}}
{{- define "collabora-online.daemonServiceAccountName" -}}
{{- if .Values.daemonSetServiceAccount.create }}
{{- printf "%s-daemonset" (default (include "collabora-online.fullname" .) .Values.daemonSetServiceAccount.name) }}
{{- else }}
{{- default "default" .Values.daemonSetServiceAccount.name }}
{{- end }}
{{- end }}

{{/*
Validate one coolwsd setting path destined for the overrides.d file.
Context: dict with "key" (the setting path) and "root" (the chart root).
Rejects characters that would corrupt the key=value file format, and
settings that the chart already delivers through environment variables,
which rank higher than overrides.d and would silently win.
*/}}
{{- define "collabora-online.validateConfigKey" -}}
{{- $key := .key }}
{{- if not (regexMatch "^[a-zA-Z0-9_.@\\[\\]-]+$" $key) }}
{{- fail (printf "collabora config key %q is not a valid coolwsd setting path (allowed: letters, digits, '.', '_', '-', '[', ']', '@')" $key) }}
{{- end }}
{{- if or (eq $key "admin_console.username") (eq $key "admin_console.password") }}
{{- fail (printf "%q cannot be set here: the chart always injects the admin credentials as environment variables, which override it. Use collabora.username/password or collabora.existingSecret instead" $key) }}
{{- end }}
{{- if and (eq $key "server_name") .root.Values.collabora.server_name }}
{{- fail "server_name cannot be set here while collabora.server_name is also set: the environment variable overrides it. Use collabora.server_name only" }}
{{- end }}
{{- end }}

{{/*
Render collabora.config as key=value lines for the coolwsd overrides.d file.
Iterating a map in Helm yields the keys in sorted order, so the output is stable.
*/}}
{{- define "collabora-online.configOverrides" -}}
{{- $root := . }}
{{- range $key, $value := .Values.collabora.config }}
{{- include "collabora-online.validateConfigKey" (dict "key" $key "root" $root) }}
{{- if contains "\n" (toString $value) }}
{{- fail (printf "collabora.config[%q]: the value must not contain newlines" $key) }}
{{- end }}
{{ $key }}={{ toString $value }}
{{- end }}
{{- end }}

{{/*
Normalize collabora.configFromSecrets: apply defaults and validate every
entry. Returns a YAML map of configKey to {create, value, name, key} for use
with fromYaml. All defaulting and validation lives here so the other
templates can rely on complete entries.
*/}}
{{- define "collabora-online.configFromSecretsNormalized" -}}
{{- $defaultName := printf "%s-config-secrets" (include "collabora-online.fullname" .) }}
{{- $out := dict }}
{{- range $configKey, $entry := .Values.collabora.configFromSecrets }}
{{- if not (kindIs "map" $entry) }}
{{- fail (printf "collabora.configFromSecrets[%q] must be a map with create/value/name/key" $configKey) }}
{{- end }}
{{- include "collabora-online.validateConfigKey" (dict "key" $configKey "root" $) }}
{{- $create := default false $entry.create }}
{{- $value := toString (default "" $entry.value) }}
{{- $name := toString (default "" $entry.name) }}
{{- $key := toString (default "" $entry.key) }}
{{- if $create }}
{{- if not $value }}
{{- fail (printf "collabora.configFromSecrets[%q]: value is required when create is true" $configKey) }}
{{- end }}
{{- $name = default $defaultName $name }}
{{- else }}
{{- if $value }}
{{- fail (printf "collabora.configFromSecrets[%q]: value is only allowed when create is true" $configKey) }}
{{- end }}
{{- if not $name }}
{{- fail (printf "collabora.configFromSecrets[%q]: name of an existing Secret is required when create is false" $configKey) }}
{{- end }}
{{- end }}
{{- if not (regexMatch "^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$" $name) }}
{{- fail (printf "collabora.configFromSecrets[%q]: name %q is not a valid Secret name" $configKey $name) }}
{{- end }}
{{- if not $key }}
{{- if regexMatch "^[-._a-zA-Z0-9]+$" $configKey }}
{{- $key = $configKey }}
{{- else }}
{{- fail (printf "collabora.configFromSecrets[%q]: an explicit key is required because the setting path is not a valid Secret key name" $configKey) }}
{{- end }}
{{- end }}
{{- if not (regexMatch "^[-._a-zA-Z0-9]+$" $key) }}
{{- fail (printf "collabora.configFromSecrets[%q]: key %q is not a valid Secret key name" $configKey $key) }}
{{- end }}
{{- $_ := set $out $configKey (dict "create" $create "value" $value "name" $name "key" $key) }}
{{- end }}
{{- $out | toYaml }}
{{- end }}

{{/*
Render collabora.configFromSecrets as key=@file: lines pointing at the
mounted secret files. The secret values themselves never enter the ConfigMap.
*/}}
{{- define "collabora-online.secretConfigOverrides" -}}
{{- $entries := include "collabora-online.configFromSecretsNormalized" . | fromYaml }}
{{- range $configKey, $entry := $entries }}
{{ $configKey }}=@file:/etc/coolwsd/secret-overrides/{{ $entry.name }}/{{ $entry.key }}
{{- end }}
{{- end }}

{{/*
The sorted, deduplicated Secret names referenced by configFromSecrets,
as a YAML object {names: [...]} for use with fromYaml.
*/}}
{{- define "collabora-online.configSecretNames" -}}
{{- $entries := include "collabora-online.configFromSecretsNormalized" . | fromYaml }}
{{- $secretNames := dict }}
{{- range $configKey, $entry := $entries }}
{{- $_ := set $secretNames $entry.name true }}
{{- end }}
names: {{ keys $secretNames | sortAlpha | toJson }}
{{- end }}

{{/*
Volume mounts for the coolwsd configuration overrides: the overrides.d
directory from the ConfigMap, plus one mount per referenced Secret.
*/}}
{{- define "collabora-online.configOverridesVolumeMounts" -}}
{{- if or .Values.collabora.config .Values.collabora.configFromSecrets }}
- name: coolwsd-overrides
  mountPath: /etc/coolwsd/overrides.d
  readOnly: true
{{- end }}
{{- range $name := (include "collabora-online.configSecretNames" . | fromYaml).names }}
- name: {{ printf "secret-override-%s" $name | trunc 63 | trimSuffix "-" }}
  mountPath: /etc/coolwsd/secret-overrides/{{ $name }}
  readOnly: true
{{- end }}
{{- end }}

{{/*
Volumes for the coolwsd configuration overrides.
*/}}
{{- define "collabora-online.configOverridesVolumes" -}}
{{- if or .Values.collabora.config .Values.collabora.configFromSecrets }}
- name: coolwsd-overrides
  configMap:
    name: {{ include "collabora-online.fullname" . }}
    items:
      {{- if .Values.collabora.config }}
      - key: coolwsd-config-overrides
        path: 10-config
      {{- end }}
      {{- if .Values.collabora.configFromSecrets }}
      - key: coolwsd-secret-overrides
        path: 20-secrets
      {{- end }}
{{- end }}
{{- range $name := (include "collabora-online.configSecretNames" . | fromYaml).names }}
- name: {{ printf "secret-override-%s" $name | trunc 63 | trimSuffix "-" }}
  secret:
    secretName: {{ $name | quote }}
{{- end }}
{{- end }}
