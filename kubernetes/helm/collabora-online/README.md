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

   - For production enviroment we recommended following resource values. We recommend appending `extra_params` with `--o:num_prespawn_children=4`. It defines number of child processes to keep started in advance and waiting for new clients

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

## In-namespace reverse proxy (OpenShift or clusters without an ingress controller)

Collabora Online needs session affinity: every request for one document must
reach the same pod. The usual way to get this is an ingress controller that
hashes on a request parameter. On clusters where you cannot install an ingress
controller (for example OpenShift, where the cluster ingress is the built-in
Router and you only have namespaced rights), the chart can instead deploy a
small nginx reverse proxy inside your namespace. nginx hashes on a request
parameter and load-balances across the Collabora replicas, and you front it
with whatever entry point your cluster already gives you (an OpenShift Route,
or a plain Service).

Enable it with `reverseProxy.enabled=true`. It creates:

- an nginx deployment (the unprivileged image, so it passes OpenShift
  `restricted-v2` with no extra grants),
- a `ClusterIP` Service for the proxy,
- a headless Service that resolves to the individual Collabora pods (nginx
  hashes across these),
- a reloader sidecar that watches the Collabora EndpointSlices and reloads
  nginx when the pod set changes, so the upstream tracks live pods after a
  restart or scale. It uses a namespaced Role only. Disable it with
  `reverseProxy.endpointReloader.enabled=false` on clusters that forbid a
  shared process namespace, then reload nginx by hand after pod changes.

`reverseProxy.hashParam` chooses what nginx hashes on. The default `WOPISrc`
gives correct per-document affinity for a standalone multi-replica deployment
with no extra components. Set it to `RouteToken` and turn on
`reverseProxy.controller.enabled` (with `reverseProxy.controller.upstream`
pointing at the COOL Controller service) when running with the COOL Controller.

`reverseProxy.controller.enabled` only proxies the client-facing routeToken
endpoint (`/controller`), so it can share the documents' external host. The
controller's monitor WebSocket does not go through the proxy: point each COOL
pod's `monitors.monitor` straight at the controller Service over cluster DNS.

### OpenShift quickstart

This serves Collabora through the default OpenShift Router, with the proxy
doing the load balancing. The Collabora pods run under `restricted-v2`, so the
per-document jail is turned off and its working paths move under `/tmp`.

``` bash
helm install collabora-online collabora/collabora-online -n collabora \
  --set replicaCount=3 \
  --set 'collabora.aliasgroups[0].host=https://your-wopi-host' \
  --set 'securityContext.runAsNonRoot=true' \
  --set 'securityContext.seccompProfile.type=RuntimeDefault' \
  --set 'securityContext.capabilities.drop[0]=ALL' \
  --set 'collabora.extra_params=--o:ssl.enable=false --o:ssl.termination=false --o:security.capabilities=false --o:child_root_path=/tmp/coolwsd-child-roots --o:cache_files.path=/tmp/coolwsd-cache' \
  --set reverseProxy.enabled=true \
  --set reverseProxy.route.enabled=true \
  --set reverseProxy.route.host=cool.apps.example.com
```

The Collabora `child_root_path` and `cache_files.path` need writable emptyDir
mounts under `/tmp`. Add them with `extraVolumes` and `extraVolumeMounts`.

### Wiring with the COOL Controller

With the controller, hash on `RouteToken`, enable the `/controller` proxy, and
split the two controller URLs in the Collabora config. The client-facing
`indirection_endpoint.url` goes through the proxy's `/controller` on the
documents' host. The `monitors.monitor` WebSocket goes straight to the
controller Service in-cluster, so it does not pass through nginx.

``` yaml
reverseProxy:
  enabled: true
  hashParam: RouteToken
  controller:
    enabled: true
    upstream: cool-controller.collabora.svc.cluster.local:9000
  route:
    enabled: true
    host: cool.apps.example.com

collabora:
  extra_params: >-
    --o:ssl.enable=false
    --o:ssl.termination=false
    --o:indirection_endpoint.url=http://cool.apps.example.com/controller/routeToken
    --o:monitors.monitor[0]=ws://cool-controller.collabora.svc.cluster.local:9000/controller/ws
    --o:monitors.monitor[0][@retryInterval]=5
```

`indirection_endpoint.url` (client-facing) uses the external host and the
proxy's `/controller`. `monitors.monitor` (in-cluster) uses the controller
Service directly.

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
