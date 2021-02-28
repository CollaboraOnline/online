# Collabora Online for Kubernetes

## Helm chart for deploying Collabora Online in Kubernetes cluster

How to test this specific setup:
  1. Install Kubernetes cluster locally - minikube - https://minikube.sigs.k8s.io/docs/
  2. Install helm - https://helm.sh/docs/intro/install/
  3. Prepare the namespace in local kubernetes cluster with this command :
```
kubectl create namespace collabora
```
  4. Install helm-chart using below command
```
helm install --namespace=collabora --generate-name collabora-online
```
  5. Finally spin the collabora-online pods in kubernetes
```
kubectl -n collabora describe service collabora-online
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
* What is the outside port that multiple loolwsd servers actually answering ?
```
minikube service --url collabora-online -n collabora
```
example output :
```
|-----------|------------------|-------------|------------------------|
| NAMESPACE |       NAME       | TARGET PORT |          URL           |
|-----------|------------------|-------------|------------------------|
| collabora | collabora-online |             | http://127.0.0.1:55064 |
|-----------|------------------|-------------|------------------------|
http://127.0.0.1:55064
```
so for this example http:// 127.0.0.1:55064 address should only response as "OK" on a plain html page, it means that it is ready to be used by your WOPI-like host of your local setup

## Notes:
* If you wish to dive into advanced settings of kubernetes deployment feel free to update values.yaml file to achieve that
* Don't forget that you have to create the namespace (default is collabora) you specified in collabora-online/values.yaml file
