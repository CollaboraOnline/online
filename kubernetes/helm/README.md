# LibreOffice Online Helm Chart

Chart for deploying LibreOffice Online in Kubernetes cluster.</br>

How to test:
  1. Install Kubernetes cluster locally - minikube - https://minikube.sigs.k8s.io/docs/start/linux/
  2. Install helm - needed version >= 3.0.0 - https://helm.sh/docs/intro/install/
  3. Update libreoffice-online/values.yaml with your required settings for environmentVariablesLool 
  username/password/domain settings
  4. Install helm-chart using below command

```
helm install --namespace=${your desired namespace} --generate-name libreoffice-online
```

Access LibreOffice Online locally through service ClusterIP and port 9980.

```
kubectl -n ${your desired namespace} describe service libreoffice-online
```