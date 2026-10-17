---
title: Deploying to an on-prem Windows server
description: Three ways to run an installer or an Ansible playbook on a Windows server outside AWS (CodeDeploy, Ansible over WinRM, and Systems Manager), and which direction the network connection goes in each.
order: 0
updated: 2026-10-12
---

Say a team builds its app in AWS, and one of the places it runs is a Windows server in a company data center, `app01.example.com`. Every release produces a new installer, `reporting-service-2.4.0.msi`, and the release pipeline has to get it installed on `app01` without anyone logging in to click through it. Three tools can do that job, and the biggest difference between them is which machine opens the network connection. That direction decides what the data center's firewall has to allow, and the firewall usually decides the answer.

## A few terms

- **On-prem** (on-premises): running in a data center or office you control, not in a cloud provider's.
- **Pipeline**: the automated steps that take a change from code to a running release: build, test, deploy.
- **Agent**: a small program installed on a server that does work on a service's behalf, like the CodeDeploy agent or SSM Agent.
- **Inbound and outbound**: from the server's point of view, an inbound connection is one something else opens to it, and an outbound connection is one the server opens itself. A firewall rule usually allows one direction for a given port.
- **MSI**: a Windows Installer package, the `.msi` file that `msiexec` installs [@ms-msiexec].
- **WinRM** (Windows Remote Management): the Windows service that lets another machine run commands on this one over the network [@ansible-windows-winrm].
- **Ansible**: a tool that configures machines by running **playbooks**, files that list the steps to apply, from a **control node**, the machine where Ansible itself runs [@ansible-install].
- **CodeDeploy** and **Systems Manager**: two AWS services that can run work on servers, including servers that aren't in AWS [@aws-codedeploy-onprem, @aws-ssm-run-command].

## Who opens the connection

<div class="conn-dir" role="img" aria-label="Three ways to reach app01, a Windows server inside a data center, from outside it. CodeDeploy: the CodeDeploy agent on app01 opens an outbound HTTPS connection on port 443 to the CodeDeploy service in AWS and asks for work. Ansible: a control node outside opens an inbound WinRM connection on port 5986 to app01, so the data center firewall needs a rule allowing port 5986 in. Systems Manager: SSM Agent on app01 opens an outbound HTTPS connection on port 443 to Systems Manager in AWS and asks for work.">
<svg viewBox="0 0 400 206" aria-hidden="true" focusable="false">
<defs><marker id="cd-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="cd-arrowhead" d="M0,0 L8,4 L0,8 z"/></marker><marker id="cd-head-in" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="cd-arrowhead-in" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<text class="cd-zone" x="80" y="14">outside the data center</text>
<text class="cd-zone" x="320" y="14">inside the data center</text>
<text class="cd-wall-label" x="200" y="14">firewall</text>
<rect class="cd-wall" x="194" y="22" width="12" height="180" rx="2"/>
<rect class="cd-box" x="10" y="30" width="140" height="40" rx="4"/>
<text class="cd-name" x="80" y="47">CodeDeploy</text>
<text class="cd-small" x="80" y="60">AWS service</text>
<rect class="cd-box cd-server" x="250" y="30" width="140" height="40" rx="4"/>
<text class="cd-name" x="320" y="47">app01</text>
<text class="cd-small" x="320" y="60">CodeDeploy agent</text>
<line class="cd-arrow" x1="249" y1="50" x2="152" y2="50" marker-end="url(#cd-head)"/>
<text class="cd-label" x="172" y="44">443 out</text>
<rect class="cd-box" x="10" y="90" width="140" height="40" rx="4"/>
<text class="cd-name" x="80" y="107">Ansible control node</text>
<text class="cd-small" x="80" y="120">Linux</text>
<rect class="cd-box cd-server" x="250" y="90" width="140" height="40" rx="4"/>
<text class="cd-name" x="320" y="107">app01</text>
<text class="cd-small" x="320" y="120">WinRM listener</text>
<line class="cd-arrow cd-in" x1="151" y1="110" x2="248" y2="110" marker-end="url(#cd-head-in)"/>
<text class="cd-label cd-in-label" x="172" y="104">5986 in</text>
<text class="cd-label cd-in-label cd-start" x="214" y="145">needs an inbound rule</text>
<rect class="cd-box" x="10" y="156" width="140" height="40" rx="4"/>
<text class="cd-name" x="80" y="173">Systems Manager</text>
<text class="cd-small" x="80" y="186">AWS service</text>
<rect class="cd-box cd-server" x="250" y="156" width="140" height="40" rx="4"/>
<text class="cd-name" x="320" y="173">app01</text>
<text class="cd-small" x="320" y="186">SSM Agent</text>
<line class="cd-arrow" x1="249" y1="176" x2="152" y2="176" marker-end="url(#cd-head)"/>
<text class="cd-label" x="172" y="170">443 out</text>
</svg>
</div>

<p class="bitgrid-caption">The arrows point from the machine that opens the connection. With both agents, <code>app01</code> reaches out and asks for work, so the firewall only has to let it out. With Ansible, the control node reaches in, so the firewall has to let something in.</p>

Both agents work the same way: the agent on `app01` opens a connection out to the AWS service and asks whether there's anything to do, and the work comes back over that connection. Nothing outside ever connects in to the server [@aws-codedeploy-agent, @aws-ssm-vpc-endpoints]. Ansible is the other way around. The control node connects to WinRM on the server and runs the steps over that connection [@ansible-intro-windows], so a path from the control node to `app01` has to exist and the firewall has to allow it.

| | CodeDeploy | Ansible over WinRM | Systems Manager |
|---|---|---|---|
| Who opens the connection | The agent on the server | The control node | The agent on the server |
| Inbound rule on the server | None | TCP 5985 (HTTP) or 5986 (HTTPS) | None |
| Outbound from the server | HTTPS 443 to AWS | None | HTTPS 443 to AWS |
| Runs an installer | Yes, from a hook script | Yes | Yes, as a command |
| Runs a playbook against the server | Only through a Linux control node | Yes | Only through a Linux control node |

The rest of this primer takes them one at a time, then [how to choose](#which-one-to-pick).

## CodeDeploy on a non-AWS server {only: AWS}

CodeDeploy treats any machine that can run its agent and reach AWS's public endpoints as an **on-premises instance**, and deploys to it the same way it deploys to EC2 [@aws-codedeploy-onprem, @aws-codedeploy-onprem-prereqs]. The agent is tested on Windows Server 2016, 2019, 2022, and 2025 [@aws-codedeploy-agent], and its only network requirement is outbound HTTPS on port 443 [@aws-codedeploy-onprem-prereqs].

A deployment is a bundle of files with an `appspec.yml` at its root. The AppSpec file says where the files go and which scripts to run at each **lifecycle event**, the named steps of a deployment such as `BeforeInstall`, `AfterInstall`, and `ValidateService` [@aws-codedeploy-hooks]. For `app01`, the bundle holds the MSI and one script:

```yaml
version: 0.0
os: windows
files:
  - source: installer
    destination: C:\deploy\reporting-service
hooks:
  AfterInstall:
    - location: scripts\install-msi.ps1
      timeout: 1800
```

That's the shape of AWS's AppSpec example, with the Windows changes its docs call for: `os: windows`, a fully qualified `destination` path, and no `runas` setting, which Windows Server doesn't support [@aws-codedeploy-appspec-example]. `timeout` is how long the script may run before it counts as failed. It can be at most 3600 seconds (an hour) for everything in one lifecycle event, and a script that runs past it fails the deployment on that server [@aws-codedeploy-hooks].

### The hook script

CodeDeploy treats an exit code of 0 as success and anything else as failure [@aws-codedeploy-appspec-example]. Windows Installer doesn't quite agree. It reports success with 0, and also with 3010 (installed, restart needed) and 1641 (installed, restart started) [@ms-msi-error-codes]. A script that passes `msiexec`'s exit code straight through fails a deployment that worked, so `install-msi.ps1` translates it:

```powershell
$msi = 'C:\deploy\reporting-service\reporting-service-2.4.0.msi'
$log = 'C:\deploy\reporting-service\install.log'

# /i installs, /qn shows no UI, /l*v writes a detailed log
$p = Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn /l*v `"$log`"" -Wait -PassThru

# 0, 3010, and 1641 all mean the install succeeded
if ($p.ExitCode -in 0, 3010, 1641) { exit 0 }
exit $p.ExitCode
```

`msiexec`'s `/i` installs the package, `/qn` turns off its user interface, and `/l*v` writes a log of everything it did [@ms-msiexec]. `-Wait` makes `Start-Process` wait for the installer to finish, and `-PassThru` returns the process so the script can read its exit code [@ms-start-process]. Without `-Wait`, the script would return before the install did. A restart-required result still needs a restart scheduled somewhere, and this script deliberately leaves that decision to whoever owns the server.

### Registering the server {only: AWS}

Before `app01` can receive deployments, it has to be registered with CodeDeploy, using an administrator account on the server [@aws-codedeploy-onprem-prereqs]. AWS recommends registering with an **IAM session ARN**, which gives the agent temporary credentials, for production deployments of any size. The other method, an IAM user with permanent access keys, is only meant for non-production use [@aws-codedeploy-onprem-register].

The temporary credentials expire after an hour at most, so something on your side has to keep replacing them, either a scheduled job that copies fresh credentials from your own identity system to the server or one on the server that requests them from AWS. If the credentials aren't refreshed, deployments to the server fail [@aws-codedeploy-session-arn]. That refresh job is the part of this option most likely to be forgotten, and the first thing to check when deployments that used to work start failing.

## Ansible over WinRM

Ansible doesn't install an agent on the machines it manages. The control node connects to each Windows host and runs the playbook's steps over that connection. It can use WinRM, PowerShell remoting over WinRM, or SSH, which Ansible has officially supported for Windows since version 2.18 [@ansible-intro-windows]. Targets need Windows Server 2016 or Windows 10 or newer [@ansible-intro-windows].

WinRM listens on TCP 5985 for HTTP and 5986 for HTTPS [@ansible-windows-winrm], and both are inbound to the server. The control node needs a network path to `app01`, through a VPN or a private connection if it runs outside the data center, or none at all if it runs inside.

### The control node can't be Windows

Ansible's control node has to be a UNIX-like machine with Python, such as Linux or macOS. Windows only works under WSL (the Windows Subsystem for Linux), and native Windows isn't supported [@ansible-install, @ansible-intro-windows]. So a playbook can't simply run on `app01` itself. It has to run from a Linux machine that reaches `app01` over WinRM.

To check that the control node can reach the server and log in, Ansible has a test module that runs a trivial command over the connection [@ansible-win-ping]:

```bash
ansible app01.example.com -m ansible.windows.win_ping
```

The control node is always Linux or macOS, so this one has no PowerShell version.

### Authentication

WinRM supports several ways to log in, and they differ in which accounts work and whether the traffic is protected without HTTPS [@ansible-windows-winrm]:

| Method | Local accounts | Domain accounts | Encrypted over plain HTTP |
|---|---|---|---|
| Basic | Yes | No | No |
| Certificate | Yes | No | No |
| NTLM | Yes | Yes | Yes |
| Kerberos | No | Yes | Yes |
| CredSSP | Yes | Yes | Yes |

Ansible's guidance is Kerberos when the server is in a domain, and Basic or NTLM over HTTPS (port 5986) for local accounts. It warns against Basic or NTLM over an HTTP listener, since they offer no encryption or very weak encryption there, and it treats CredSSP as a last resort, because it hands the server credentials it can reuse elsewhere [@ansible-windows-winrm].

## Systems Manager Run Command {only: AWS}

**Run Command** is the part of AWS Systems Manager that runs commands on **managed nodes**: EC2 instances, or other machines set up for Systems Manager [@aws-ssm-run-command]. Setting up `app01` takes a **hybrid activation**, an activation code and ID you create in AWS with an IAM role attached, which you give to SSM Agent when you install it on the server [@aws-ssm-hybrid-activation].

The agent then connects out over HTTPS on port 443 to the Systems Manager endpoints (`ssm`, `ssmmessages`, and `ec2messages` in your Region). It opens every connection itself, so the firewall needs no inbound rule [@aws-ssm-vpc-endpoints]. Running the installer is one Run Command invocation that executes the same PowerShell as the CodeDeploy hook above, without a bundle, an AppSpec file, or lifecycle events. Systems Manager can also run Ansible playbooks, but its `AWS-ApplyAnsiblePlaybooks` document runs Ansible on the managed node itself, and the dependencies it installs are Linux packages, so it fits a Linux control node, not `app01` [@aws-ssm-ansible].

The pricing changed in 2026. Registering machines outside AWS is now free, and since September 30, 2026, Run Command on those machines costs $0.002 per invocation, while it stays free on EC2 [@aws-ssm-pricing, @aws-ssm-run-command]. Check the pricing page before relying on it, since it changed twice in 2026.

## Which one to pick

- **The server may only connect out, and the job is an installer.** CodeDeploy if you want deployments tracked, with an AppSpec file, lifecycle events, and a history per server. Run Command if one command is enough.
- **Playbooks already exist, and a path from a Linux control node to the server is acceptable.** Ansible over WinRM, over HTTPS, with Kerberos or NTLM.
- **Both.** The control node is a Linux machine, so it can run a CodeDeploy or SSM agent itself. The pipeline deploys to the control node, and the control node runs the playbook against `app01` over WinRM. Only the control node needs outbound 443, and only it needs a path in to `app01`, which is easier to allow when both sit in the same data center.

In most cases the firewall picks for you. If nothing may connect in to `app01`, the choice is between the two agents.
