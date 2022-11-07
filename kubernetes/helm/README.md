# Collabora Online for Kubernetes

In order for Collaborative Editing to function correctly on kubernetes, it is vital to ensure that all users editing the same document end up being served by the same pod. Using the WOPI protocol, the https URL includes a unique identifier (WOPISrc) for use with this document. Thus load balancing can be done by using WOPISrc – ensuring that all URLs that contain the same WOPISrc are sent to the same pod.

## Helm chart for deploying Collabora Online in Kubernetes cluster

How to test this specific setup:
  1. Install Kubernetes cluster locally - minikube - https://minikube.sigs.k8s.io/docs/
  2. Install helm - https://helm.sh/docs/intro/install/
  3. install HAProxy Kubernetes Ingress Controller - https://www.haproxy.com/documentation/kubernetes/latest/installation/community/kubernetes/
  4. Prepare the namespace in local kubernetes cluster with this command :
```
kubectl create namespace collabora
```
  5. Install helm-chart using below command
```
helm install collabora-online ./kubernetes/helm/collabora-online/
```
  6. Finally spin the collabora-online in kubernetes

      A. HAProxy service is deployed as NodePort so we can access it with node's ip address. To get node ip
      ```
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
      192.168.0.106   coolwsd.public.example.com
      ```

To check if everything is setup correctly you can run:
```
curl -I -H 'Host: coolwsd.public.example.com' 'http://192.168.0.106:30536/'
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
```
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
```
kubectl get ingress -n collabora
```
example output :
```
|-----------|------------------|--------------------------|------------------------|-------|
| NAMESPACE |       NAME       |           HOSTS          |         ADDRESS        | PORTS |
|-----------|------------------|--------------------------|------------------------|-------|
| collabora | collabora-online |coolwsd.public.example.com|                        |  80   |
|-----------|------------------|--------------------------|------------------------|-------|
```


## Notes:
* If you wish to dive into advanced settings of kubernetes deployment feel free to update values.yaml file to achieve that
* Don't forget that you have to create the namespace (default is collabora) you specified in collabora-online/values.yaml file
