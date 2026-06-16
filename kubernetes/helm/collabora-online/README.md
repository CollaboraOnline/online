# Collabora Online for Kubernetes

In order for Collaborative Editing and copy/paste to function correctly on kubernetes, it is vital to ensure that all users editing the same document and all the clipboard request end up being served by the same pod. Using the WOPI protocol, the https URL includes a unique identifier (WOPISrc) for use with this document. Thus load balancing can be done by using WOPISrc -- ensuring that all URLs that contain the same WOPISrc are sent to the same pod.

## Deploying Collabora Online in Kubernetes

1. Install [helm](https://helm.sh/docs/intro/install/)

2. Setting up Kubernetes Ingress Controller

   A.  Nginx:

   Install [Nginx Ingress
   Controller](https://kubernetes.github.io/ingress-nginx/deploy/)

   B.  HAProxy:

   Install [HAProxy Ingress
   Controller](https://www.haproxy.com/documentation/kubernetes-ingress/)

   ---

   **Note:**

   **Openshift** uses minimized version of HAproxy called
   [Router](https://docs.openshift.com/container-platform/3.11/install_config/router) that doesn\'t support all functionality of HAProxy but for COOL we need advance annotations Therefore it is recommended deploy [HAproxy Kubernetes Ingress](https://artifacthub.io/packages/helm/haproxytech/kubernetes-ingress) in `collabora` namespace

   ---

3. Create an `my_values.yaml` (if your setup differs e.g. take an look in then `values.yaml ./collabora-online/values.yaml`) of the
   helmchart

   A.  HAproxy:

   ``` yaml
   replicaCount: 3

   ingress:
      enabled: true
      className: "haproxy"
      annotations:
         haproxy.org/timeout-tunnel: "3600s"
         haproxy.org/backend-config-snippet: |
            balance url_param WOPISrc check_post
            hash-type consistent
      hosts:
         - host: chart-example.local
            paths:
            - path: /
            pathType: ImplementationSpecific

   autoscaling:
      enabled: false

   collabora:
      aliasgroups:
         - host: "https://example.integrator.com:443"
      extra_params: --o:ssl.enable=false --o:ssl.termination=true
      # with images 26.04 or later, prefer the structured `config` map over
      # extra_params, see the "Structured configuration" section below
      # for production enviroment we recommend appending `extra_params` with `--o:num_prespawn_children=4`. It defines number of child processes to keep started in advance and waiting for new clients

   resources:
      limits:
         cpu: "1800m"
         memory: "2000Mi"
      requests:
         cpu: "1800m"
         memory: "2000Mi"

   # for production enviroment we recommended following values
   # resources:
      # limits:
         # cpu: "8000m"
         # memory: "8000Mi"
      # requests:
         # cpu: "4000m"
         # memory: "6000Mi"
   ```

   B. Nginx:

   ``` yaml
   replicaCount: 3

   ingress:
      enabled: true
      className: "nginx"
      annotations:
         nginx.ingress.kubernetes.io/upstream-hash-by: "$arg_WOPISrc"
         nginx.ingress.kubernetes.io/proxy-body-size: "0"
         nginx.ingress.kubernetes.io/proxy-read-timeout: "600"
         nginx.ingress.kubernetes.io/proxy-send-timeout: "600"
      hosts:
         - host: chart-example.local
            paths:
            - path: /
            pathType: ImplementationSpecific

   autoscaling:
      enabled: false

   collabora:
      aliasgroups:
         - host: "https://example.integrator.com:443"
      extra_params: --o:ssl.enable=false --o:ssl.termination=true
      # with images 26.04 or later, prefer the structured `config` map over
      # extra_params, see the "Structured configuration" section below
      # for production enviroment we recommend appending `extra_params` with `--o:num_prespawn_children=4`. It defines number of child processes to keep started in advance and waiting for new clients

   resources:
      limits:
         cpu: "1800m"
         memory: "2000Mi"
      requests:
         cpu: "1800m"
         memory: "2000Mi"

   # for production enviroment we recommended following values
   # resources:
      # limits:
         # cpu: "8000m"
         # memory: "8000Mi"
      # requests:
         # cpu: "4000m"
         # memory: "6000Mi"
   ```

   ---

   **Note:**

   - **Horizontal Pod Autoscaling(HPA) is disabled for now. Because after scaling it breaks the collaborative editing and copy/paste
      Therefore please set replicaCount as per your needs**
   -  If you have multiple host and aliases setup set aliasgroups in `my_values.yaml`:

      ``` yaml
      collabora:
         - host: "<protocol>://<host-name>:<port>"
            # if there are no aliases you can ignore the below line
            aliases: ["<protocol>://<its-first-alias>:<port>, <protocol>://<its-second-alias>:<port>"]
         # more host and aliases list is possible
      ```

   - Specify `server_name` when the hostname is not reachable directly for example behind reverse-proxy

      ``` yaml
      collabora:
         server_name: <hostname>:<port>
      ```

   - For production enviroment we recommended following resource values. We recommend setting `num_prespawn_children` to 4 (through `extra_params`, or through `collabora.config` with images 26.04 or later). It defines number of child processes to keep started in advance and waiting for new clients

      ``` yaml
      resources:
         limits:
            cpu: "8000m"
            memory: "8000Mi"
         requests:
            cpu: "4000m"
            memory: "6000Mi"
      ```

   - In **Openshift** , it is recommended to use HAproxy deployment instead of default router. And add `className` in ingress block
     so that Openshift uses HAProxy Ingress Controller instead of `Router`:

      ``` yaml
      ingress:
         className: "haproxy"
      ```
   ---

4. Install helm-chart using below command, it should deploy the collabora-online

   ``` bash
   helm repo add collabora https://collaboraonline.github.io/online/
   helm install --create-namespace --namespace collabora collabora-online collabora/collabora-online -f my_values.yaml
   ```

5. Follow only if you are using `NodePort` service type in HAProxy and/or using minikube to setup, otherwise skip

   A. HAProxy service is deployed as NodePort so we can access it with node's ip address. To get node ip
   ```bash
   minikube ip
   ```
   Example output:
   ```
   192.168.0.106
   ```
   B. Each container port is mapped to a `NodePort` port via the `Service` object. To find those ports
   ```
   kubectl get svc --namespace=haproxy-controller
   ```
   Example output:

   ```
   |------------------|-----------|----------------|--------------|--------------------------------------------|
   | NAME             | TYPE      | CLUSTER-IP     | EXTERNAL-IP  | PORT(S)                                    |
   | ---------------- | --------- | -------------- | ------------ | ------------------------------------------ |
   | haproxy-ingress  | NodePort  | 10.108.214.98  | <none>       | 80:30536/TCP,443:31821/TCP,1024:30480/TCP  |
   | ---------------- | --------- | -------------- | ------------ | ------------------------------------------ |
   ```
   In this instance, the following ports were mapped:
      - Container port 80 to NodePort 30536
      - Container port 443 to NodePort 31821
      - Container port 1024 to NodePort 30480

6. Additional step if deploying on minikube for testing:

   1. Get minikube ip:

      ``` bash
      minikube ip
      ```

      Example output:

      ``` bash
      192.168.0.106
      ```

   2. Add hostname to `/etc/hosts`

      ``` bash
      192.168.0.106   chart-example.local
      ```

   3. To check if everything is setup correctly you can run:

      ``` bash
      curl -I -H 'Host: chart-example.local' 'http://192.168.0.106:30536/'
      ```

      It should return a similar output as below:

      ``` bash
      HTTP/1.1 200 OK
      last-modified: Tue, 18 May 2021 10:46:29
      user-agent: COOLWSD WOPI Agent 6.4.8
      content-length: 2
      content-type: text/plain
      ```

## Structured configuration

The `collabora.config` map configures coolwsd without editing coolwsd.xml or
building long `--o:` option strings. Each key is a coolwsd setting path in
the same syntax as the `--o:` command-line option, including `[n]` indices
and `[@attr]` attributes. The chart renders the map into a ConfigMap that is
mounted at `/etc/coolwsd/overrides.d` inside the pod, and coolwsd applies it
at startup on top of coolwsd.xml. It needs an image of version 26.04 or
later.

``` yaml
collabora:
   # clear the deprecated default, it would override "ssl.enable" below
   extra_params: ""
   config:
      "ssl.enable": false
      "indirection_endpoint.url": "http://test.collabora.online:30080/controller/routeToken"
      "monitors.monitor[0]": "ws://test.collabora.online:30080/controller/ws"
      "monitors.monitor[0][@retryInterval]": "5"
      "security.server_signature": true
```

Format rules:

- Keys that contain brackets must be quoted in YAML.
- Quote large numbers as strings, otherwise Helm may render them in
  scientific notation.
- Prefer a values file over `helm --set` for these keys, because the dots in
  the key names collide with `--set` path syntax.
- Key names are not validated against a schema. A typo creates an unknown
  setting that coolwsd ignores. Each applied key is logged at INFO level at
  startup, which helps spotting mistakes.

To bind a setting to a value stored in a Kubernetes Secret, use
`collabora.configFromSecrets`. It is a map keyed by the setting path, so an
overlay values file can override a single entry. The secret value never
enters the ConfigMap, the pod spec or the coolwsd logs. coolwsd reads it
from the mounted secret file at startup.

Each entry supports two modes:

- `create: true` makes the chart create the Secret itself from the given
  `value`. Convenient when your values files are protected anyway (SOPS,
  helm-secrets) and for test setups. `name` defaults to
  `<release fullname>-config-secrets` and `key` defaults to the setting
  path.
- `create: false` (the default) references a Secret that already exists in
  the namespace, for example one managed by the external-secrets operator.
  `name` is required.

``` yaml
collabora:
   configFromSecrets:
      # chart-created Secret, only the value is needed
      "logging.anonymize.anonymization_salt":
         create: true
         value: "change-me"
      # existing Secret managed outside the chart
      "deepl.auth_key":
         name: cool-config-secrets
         key: deepl-key
```

For the `create: false` example the Secret could have been created with:

``` bash
kubectl create secret generic cool-config-secrets -n collabora \
   --from-literal=deepl-key="..."
```

Setting paths with brackets are not valid Secret key names, so such entries
need an explicit `key`.

Precedence, strongest first: remote/dynamic configuration, `extra_params`
(`--o:` command-line options), `config` and `configFromSecrets`, the
coolwsd.xml base file, built-in defaults.

Notes:

- This feature needs an image that supports the overrides.d directory
  (Collabora Online 26.04 or later). An older image silently ignores the
  mounted overrides. The chart default therefore still uses `extra_params`
  for `ssl.enable=false`.
- `collabora.extra_params` is deprecated for images 26.04 and later, but it
  keeps working and still overrides the `config` map. When you move a
  setting to `config`, remove it from `extra_params` (including the chart
  default `--o:ssl.enable=false`), otherwise the `extra_params` value wins
  silently.
- The admin console credentials cannot be set through `config` or
  `configFromSecrets` (the chart rejects it): the chart always injects them
  as environment variables, which rank higher. Use `collabora.username`,
  `collabora.password` or `collabora.existingSecret`.
- Changing `config` or `configFromSecrets` rolls the pods automatically (the
  pod template carries a hash of the collabora values). This includes the
  `value` of `create: true` entries, so rotating a chart-created secret is
  just a `helm upgrade`. Changing only the VALUE inside an externally
  managed Secret (`create: false`) does not roll the pods. Restart them
  manually after rotating such a secret, for example with `kubectl rollout
  restart`.

## Kubernetes cluster monitoring

1. Install [kube-prometheus-stack](https://artifacthub.io/packages/helm/prometheus-community/kube-prometheus-stack), a collection of  [Grafana](http://grafana.com/) dashboards, and [Prometheus rules](https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/) combined with documentation and scripts to provide easy to operate end-to-end Kubernetes cluster monitoring with
[Prometheus](https://prometheus.io/) using the [Prometheus Operator](https://prometheus-operator.dev/).

2. Enable prometheus service monitor, rules and grafana in your

   `my_values.yaml`

   ``` yaml
   prometheus:
      servicemonitor:
         enabled: true
         labels:
            release: "kube-prometheus-stack"
      rules:
         enabled: true # will deploy alert rules
         additionalLabels:
            release: "kube-prometheus-stack"
   grafana:
      dashboards:
         enabled: true # will deploy default dashboards
   ```
   ---
   **Note:**

   Use `kube-prometheus-stack` as release name when installing [kube-prometheus-stack](https://artifacthub.io/packages/helm/prometheus-community/kube-prometheus-stack) helm chart because we have passed `release=kube-prometheus-stack` label in our `my_values.yaml`. For Grafana Dashboards you may need to enable scan in correct namespaces (or ALL), enabled by `sidecar.dashboards.searchNamespace` in [Helmchart of grafana](https://artifacthub.io/packages/helm/grafana/grafana) (which is part of PrometheusOperator, so `grafana.sidecar.dashboards.searchNamespace`)

   ---


## Kubernetes cluster logging
1. Install [Logging Operator](https://kube-logging.dev/) with an ClusterOutput "default".

2. Enable logging flow in your


   `my_values.yaml`

   ```yaml
   logging:
     enabled: true
     ecs: true
     dedot: "-"
     additionalFilters:
       - grep:
           exclude:
             - key: "$['log']['level']"
               pattern: '/(info|debug|trace)/'
     globalOutputRefs:
       - "default"
   dynamicConfig:
     logging:
       enabled: true
       ecs: true
       dedot: "-"
       globalOutputRefs:
         - "default"
     upload:
       logging:
         enabled: true
         ecs: true
         dedot: "-"
         globalOutputRefs:
           - "default"
   ```

   * `dedot`: useful if the Logging has an [global filter](https://kube-logging.dev/4.0/docs/configuration/crds/v1beta1/logging_types/#loggingspec-globalfilters) for dedot an correction for selector is possible.
   * `ecs`: Therefore the fields are remapped to filter to the [ElasticCommonSchema](https://www.elastic.co/guide/en/ecs/current/index.html).
   * `additionalFilters`: Add more filter of the logging-operator

## Dynamic/Remote configuration in kubernetes

For big setups, you may not want to restart every pod to modify WOPI
hosts, therefore it is possible to setup an additional webserver to
serve a ConfigMap for using [Remote/Dynamic
Configuration](https://sdk.collaboraonline.com/docs/installation/Configuration.html#remote-dynamic-configuration)

``` yaml
collabora:
   env:
      - name: remoteconfigurl
         value: https://dynconfig.public.example.com/config/config.json

dynamicConfig:
   enabled: true

   ingress:
      enabled: true
      annotations:
      "cert-manager.io/issuer": letsencrypt-zprod
      hosts:
      - host: "dynconfig.public.example.com"
      tls:
      - secretName: "collabora-online-dynconfig-tls"
         hosts:
            - "dynconfig.public.example.com"

   configuration:
      kind: "configuration"
      storage:
         wopi:
         alias_groups:
            groups:
            - host: "https://domain1\\.xyz\\.abc\\.com/"
               allow: true
            - host: "https://domain2\\.pqr\\.def\\.com/"
               allow: true
               aliases:
                  - "https://domain2\\.ghi\\.leno\\.de/"
```
---

**Note:**

In current state of COOL remoteconfigurl for [Remote/DynamicConfiguration](https://sdk.collaboraonline.com/docs/installation/Configuration.html#remote-dynamic-configuration) only uses HTTPS. see [here in wsd/COOLWSD.cpp](https://github.com/CollaboraOnline/online/blob/8591d323c6db99e592ac8ac8ebef0e3a95f2e6ba/wsd/COOLWSD.cpp#L1069-L1096)

---

## Useful commands to check what is happening

Where is this pods, are they ready?

``` bash
kubectl -n collabora get pod
```

example output :

``` bash
NAME                                READY   STATUS    RESTARTS   AGE
collabora-online-5fb4869564-dnzmk   1/1     Running   0          28h
collabora-online-5fb4869564-fb4cf   1/1     Running   0          28h
collabora-online-5fb4869564-wbrv2   1/1     Running   0          28h
```

What is the outside host that multiple coolwsd servers actually
answering?

``` bash
kubectl get ingress -n collabora
```

example output :

``` bash
|-----------|------------------|--------------------------|------------------------|-------|
| NAMESPACE |       NAME       |           HOSTS          |         ADDRESS        | PORTS |
|-----------|------------------|--------------------------|------------------------|-------|
| collabora | collabora-online |chart-example.local       |                        |  80   |
|-----------|------------------|--------------------------|------------------------|-------|
```

To uninstall the helm chart

``` bash
helm uninstall collabora-online -n collabora
```
