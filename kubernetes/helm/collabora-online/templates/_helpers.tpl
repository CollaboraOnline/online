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
