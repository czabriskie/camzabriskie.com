---
title: Deploying to an on-prem Windows server
description: Three ways to run an installer or Ansible against a Windows server outside AWS (CodeDeploy, WinRM from a controller, and Systems Manager) and which direction the network connection goes in each.
order: 1
updated: 2026-10-12
---

A Windows server in a data center needs an installer run on it, on demand, from a pipeline. Three tools can do that, and they differ mostly in who opens the connection. The direction decides what the firewall team has to allow, which usually decides the answer.

## The three options at a glance

| | CodeDeploy agent | WinRM from a controller | Systems Manager agent |
|---|---|---|---|
| Who connects to whom | The server's agent calls AWS | A controller calls the server | An agent on the server, set up for Systems Manager |
| Inbound firewall rule on the server | None | TCP 5985 or 5986 | Check the setup docs |
| Outbound from the server | HTTPS 443 | None | Check the setup docs |
| Runs Ansible | Awkward, see below | Yes, from a Linux controller | Not directly |

## CodeDeploy on a non-AWS server {only: AWS}

CodeDeploy treats any machine that can run its agent and reach AWS's public endpoints as an "on-premises instance" [@aws-codedeploy-onprem]. Windows Server 2016, 2019, 2022 and 2025 on x86_64 are tested platforms [@aws-codedeploy-agent].

The agent polls AWS, so the server never accepts a connection. The prerequisites list one network requirement, outbound HTTPS on port 443 [@aws-codedeploy-onprem-prereqs]. That makes CodeDeploy the easiest to get through a strict firewall.

A deployment ships a bundle with an `appspec.yml` that names scripts to run at lifecycle events. A Windows version looks like this [@aws-codedeploy-appspec-example]:

```yaml
version: 0.0
os: windows
files:
  - source: installer
    destination: c:\temp\myApp
hooks:
  AfterInstall:
    - location: Scripts\run-installer.ps1
      timeout: 1800
```

Three Windows details from the docs matter here. `destination` paths must be fully qualified. The `runas` option is not supported on Windows Server. Each lifecycle event allows at most 3600 seconds of script time, and a script that runs longer fails the deployment on that instance [@aws-codedeploy-hooks] [@aws-codedeploy-appspec-example].

An installer is a natural fit. The hook script calls it silently and returns its exit code, and a nonzero code fails the deployment.

### Registering the server {only: AWS}

Each server has to be registered before it can receive deployments. Configuring a Windows Server needs an administrator account [@aws-codedeploy-onprem-prereqs].

AWS recommends the IAM session ARN method for production, where the server uses temporary credentials. The static IAM user method is meant for non-production use [@aws-codedeploy-onprem-register]. The catch with temporary credentials is that something on your side has to keep refreshing them, since they expire after an hour at most [@aws-codedeploy-session-arn].

## Ansible and WinRM

Ansible has no agent on the target. A control node runs Ansible and reaches Windows hosts over PowerShell remoting or WinRM, with SSH also supported from Ansible 2.18 onward [@ansible-intro-windows].

WinRM listens on TCP 5985 for HTTP and 5986 for HTTPS [@ansible-windows-winrm]. Both are inbound to the Windows server, so a network path from the controller to the server has to exist, for example a VPN or a private link.

Authentication matters more than it looks:

| Method | Domain accounts | Encrypted over HTTP |
|---|---|---|
| Basic | No | No |
| NTLM | Yes | Yes |
| Kerberos | Yes | Yes |
| CredSSP | Yes | Yes |

Ansible's guidance is Kerberos in a domain, and Basic or NTLM over HTTPS for local accounts. It warns against Basic and NTLM over an HTTP listener, and it treats CredSSP as a last resort because it delegates credentials [@ansible-windows-winrm].

### The control node cannot be Windows

Ansible's control node needs a UNIX-like system. Windows works only under WSL, and native Windows is unsupported as a control node [@ansible-install]. A CodeDeploy hook on a Windows server therefore cannot simply call `ansible-playbook` the way it would on Linux. Targets can be Windows from Windows Server 2016 and Windows 10 onward [@ansible-intro-windows].

The consequence for the two tools together: use CodeDeploy for installer-style work with PowerShell, and use Ansible from a Linux controller over WinRM. Combining them means one of the two runs somewhere it was not designed for.

## Systems Manager as the third option {only: AWS}

Systems Manager Run Command can target any managed node, including non-EC2 machines in a hybrid environment that have been set up for Systems Manager [@aws-ssm-run-command]. Network requirements for the agent are in the Systems Manager setup docs, which I have not verified here. Run Command is free on EC2 nodes, while hybrid nodes are billed under the pricing page, so check the current price before committing [@aws-ssm-run-command].

## Which one to pick

- **The server may only make outbound connections, and the job is an installer.** CodeDeploy, or Run Command if you do not need deployment tracking.
- **Playbooks already exist and a network path to the server is acceptable.** Ansible over WinRM from a Linux controller.
- **Both are true.** Install the installer through CodeDeploy and keep the playbooks for what a controller can reach.

The deciding question is rarely the tool. It is whether the firewall allows an inbound connection to the server or only an outbound one.
