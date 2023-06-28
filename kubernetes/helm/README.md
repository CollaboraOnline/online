# Collabora Online for Kubernetes

In order for Collaborative Editing to function correctly on kubernetes, it is vital to ensure that all users editing the same document end up being served by the same pod. Using the WOPI protocol, the https URL includes a unique identifier (WOPISrc) for use with this document. Thus load balancing can be done by using WOPISrc – ensuring that all URLs that contain the same WOPISrc are sent to the same pod.

## Helm chart for deploying Collabora Online in Kubernetes cluster

How to test this specific setup:
  1. Install Kubernetes cluster locally - minikube - https://minikube.sigs.k8s.io/docs/
  2. Install helm - https://helm.sh/docs/intro/install/
  3. Install HAProxy Kubernetes Ingress Controller - https://www.haproxy.com/documentation/kubernetes/latest/installation/community/kubernetes/
  4. Create an `my_values.yaml` for your minikube setup (if you setup differe e.g. take an look in then [`values.yaml`](./collabora-online/values.yaml) of the helmchart - e.g. for annotations using [NGINX Ingress Controller](https://docs.nginx.com/nginx-ingress-controller/) or more komplex setups, see [Nodes](#Notes) ):

      Here an example `my_values.yaml`:
      ```yaml
      replicaCount: 3
      
      ingress:
        enabled: true
        annotations:
          haproxy.org/timeout-tunnel: "3600s"
          haproxy.org/backend-config-snippet: |
            mode http
            balance leastconn
            stick-table type string len 2048 size 1k store conn_cur
            http-request set-var(txn.wopisrcconns) url_param(WOPISrc),table_conn_cur()
            http-request track-sc1 url_param(WOPISrc)
            stick match url_param(WOPISrc) if { var(txn.wopisrcconns) -m int gt 0 }
            stick store-request url_param(WOPISrc)
        hosts:
          - host: chart-example.local
            paths:
            - path: /
              pathType: ImplementationSpecific

        image:
          tag: "latest"
          pullPolicy: Always
      ```

      Important notes:
      1. If you have multiple host and aliases setup set aliasgroups in my_values.yaml
          ```yaml
          collabora:
            - host: "<protocol>://<host-name>:<port>"
              aliases: ["<protocol>://<its-first-alias>:<port>, <protocol>://<its-second-alias>:<port>"]
          ```

      2. Specify `server_name` when the hostname is not reachable directly for example behind reverse-proxy
          ```yaml
          collabora:
            server_name: <hostname>:<port>
          ```

  5. Install helm-chart using below command (with a new namespace collabora)

      ```bash
      helm repo add collabora https://genofire.github.io/collaboraonline-helm/
      helm install --create-namespace --namespace collabora collabora-online collabora/collabora-online -f my_values.yaml
      ```

  6. Finally spin the collabora-online in kubernetes

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
      |----------------|---------|--------------|------------|------------------------------------------|
      |NAME            |TYPE     |CLUSTER-IP    |EXTERNAL-IP |PORT(S)                                   |
      |----------------|---------|--------------|------------|------------------------------------------|
      |haproxy-ingress |NodePort |10.108.214.98 |<none>      |80:30536/TCP,443:31821/TCP,1024:30480/TCP |
      |----------------|---------|--------------|------------|------------------------------------------|
      ```
      In this instance, the following ports were mapped:
       - Container port 80 to NodePort 30536
       - Container port 443 to NodePort 31821
       - Container port 1024 to NodePort 30480

      C. Now in this case to make our hostname available we have to add following line into /etc/hosts:
      ```
      192.168.0.106   chart-example.local
      ```

  7. To check if everything is setup correctly you can run:

      ```bash
      curl -I -H 'Host: chart-example.local' 'http://192.168.0.106:30536/'
      ```

      It should return a similar output as below:
      ```
      HTTP/1.1 200 OK
      last-modified: Tue, 18 May 2021 10:46:29
      user-agent: COOLWSD WOPI Agent 6.4.8
      content-length: 2
      content-type: text/plain
      ```


## Some useful commands to check what is happening :
* Where is this pods, are they ready ?

  ```bash
  kubectl -n collabora get pod
  ```

  example output :
  ```
  NAME                                READY   STATUS    RESTARTS   AGE
  collabora-online-5fb4869564-dnzmk   1/1     Running   0          28h
  collabora-online-5fb4869564-fb4cf   1/1     Running   0          28h
  collabora-online-5fb4869564-wbrv2   1/1     Running   0          28h
  ```

* What is the outside host that multiple coolwsd servers actually answering ?
  ```bash
  kubectl get ingress -n collabora
  ```

  example output :
  ```
  |-----------|------------------|---------------------|------------------------|-------|
  | NAMESPACE |       NAME       |        HOSTS        |         ADDRESS        | PORTS |
  |-----------|------------------|---------------------|------------------------|-------|
  | collabora | collabora-online | chart-example.local |                        |  80   |
  |-----------|------------------|---------------------|------------------------|-------|
  ```

* To uninstall the helm chart
  ```bash
  helm uninstall --namespace collabora collabora-online
  ```

## Notes:
* For big setups, you maybe NOT want to restart every pod to modify WOPI hosts, therefore it is possible to setup an additional webserver to serve a ConfigMap for using [Remote/Dynamic Configuration](https://sdk.collaboraonline.com/docs/installation/Configuration.html?highlight=remote#remote-dynamic-configuration):

  ```yaml
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
              - host: "https://nextcloud\\.public\\.example\\.com/"
                allow: true
              - host: "https://moodle\\.public\\.example\\.com/"
                allow: true
                aliases:
                  - "https://moodle3\\.public\\.example2\\.de/"
  ```
  PS: In current state of Collabora needs outside of debuggin for Remove/Dynamic Configuration HTTPS, see [here in wsd/COOLWSD.cpp](https://github.com/CollaboraOnline/online/blob/8591d323c6db99e592ac8ac8ebef0e3a95f2e6ba/wsd/COOLWSD.cpp#L1069-L1096)

* Works well with [Prometheus Operator](https://prometheus-operator.dev/) ([Helmchart](https://artifacthub.io/packages/helm/prometheus-community/kube-prometheus-stack)) and there setup of [Grafana](https://grafana.com/grafana/), by enabling following values:
  ```yaml
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
  PS: The labels `release=kube-prometheus-stack` is setup with the helmchart of the Prometheus Operator. For Grafana Dashboards it maybe need scan enable to scan in correct namespaces (or ALL), enabled by `sidecar.dashboards.searchNamespace` in [Helmchart of grafana](https://artifacthub.io/packages/helm/grafana/grafana) (which is part of PrometheusOperator, so `grafana.sidecar.dashboards.searchNamespace`) 
